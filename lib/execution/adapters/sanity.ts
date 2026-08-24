/**
 * Sanity adapter — create/update documents via the Content Lake HTTP API.
 *
 * Credentials: { token }  (Editor token with write)
 * Config: { projectId, dataset?, documentType?, apiVersion? }
 */

import type { AdapterContext, PublishAdapter, PublishResult, SiteChange } from "../types";

function cfg(ctx: AdapterContext) {
  return {
    projectId: String(ctx.config.projectId || "").trim(),
    dataset: String(ctx.config.dataset || "production").trim() || "production",
    documentType: String(ctx.config.documentType || "page").trim() || "page",
    apiVersion: String(ctx.config.apiVersion || "2021-06-07").trim(),
  };
}

function token(ctx: AdapterContext): string {
  return (ctx.credentials.token || "").trim();
}

async function sanityMutate(
  ctx: AdapterContext,
  mutations: unknown[]
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const { projectId, dataset, apiVersion } = cfg(ctx);
  const t = token(ctx);
  if (!projectId) return { ok: false, status: 0, body: null, error: "Sanity projectId is required." };
  if (!t) return { ok: false, status: 0, body: null, error: "Sanity write token is required." };
  try {
    const res = await fetch(
      `https://${projectId}.api.sanity.io/v${apiVersion}/data/mutate/${dataset}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
          "User-Agent": "Volo-Website-Connection",
        },
        body: JSON.stringify({ mutations }),
      }
    );
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sanityQuery(
  ctx: AdapterContext,
  query: string
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const { projectId, dataset, apiVersion } = cfg(ctx);
  const t = token(ctx);
  if (!projectId || !t) return { ok: false, status: 0, body: null, error: "Sanity projectId and token required." };
  try {
    const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
    url.searchParams.set("query", query);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${t}`, "User-Agent": "Volo-Website-Connection" },
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function docId(documentType: string, slug: string): string {
  const clean = slug.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${documentType}.${clean}`;
}

export const sanityAdapter: PublishAdapter = {
  provider: "sanity",
  label: "Sanity",
  capabilities: ["upsert_page", "update_meta"],

  async check(ctx) {
    const { projectId, dataset } = cfg(ctx);
    if (!projectId) return { ok: false, detail: "Sanity project ID is required." };
    if (!token(ctx)) return { ok: false, detail: "A Sanity token with write access is required." };
    const r = await sanityQuery(ctx, "*[_type == 'sanity.imageAsset'][0]._id");
    if (r.status === 401 || r.status === 403) {
      return { ok: false, detail: "Sanity rejected the token. Check project access and permissions." };
    }
    if (!r.ok && r.status !== 0) {
      // Query may fail on empty projects; try a trivial mutation dry-run via projects API
      const projects = await fetch(`https://api.sanity.io/v2021-06-07/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token(ctx)}` },
      }).catch(() => null);
      if (projects && (projects.status === 401 || projects.status === 403)) {
        return { ok: false, detail: "Sanity rejected the token." };
      }
      if (projects && projects.ok) {
        return { ok: true, detail: `Connected to Sanity project ${projectId} (${dataset}).` };
      }
      return { ok: false, detail: r.error || `Sanity HTTP ${r.status}` };
    }
    return { ok: true, detail: `Connected to Sanity project ${projectId} (${dataset}).` };
  },

  async apply(ctx, change: SiteChange): Promise<PublishResult> {
    const { documentType } = cfg(ctx);

    if (change.type === "delete_page") {
      const id = change.remoteId || docId(documentType, change.slug);
      const r = await sanityMutate(ctx, [{ delete: { id } }]);
      if (!r.ok && r.status !== 404) {
        return {
          ok: false,
          error: (r.body as { error?: { description?: string } } | null)?.error?.description || r.error || "Delete failed",
          retryable: r.status >= 500,
        };
      }
      return { ok: true, remoteId: id, url: null, previous: null };
    }

    if (change.type === "update_meta") {
      let slug = change.url;
      try {
        slug = new URL(change.url).pathname.replace(/^\/+|\/+$/g, "") || "index";
      } catch {
        /* keep */
      }
      const id = docId(documentType, slug);
      const patch: Record<string, unknown> = {};
      if (change.title) patch.title = change.title;
      if (change.metaDescription) patch.description = change.metaDescription;
      const r = await sanityMutate(ctx, [{ patch: { id, set: patch } }]);
      if (!r.ok) {
        return {
          ok: false,
          error: (r.body as { error?: { description?: string } } | null)?.error?.description || r.error || "Meta update failed",
          retryable: r.status >= 500,
        };
      }
      return { ok: true, remoteId: id, url: null, previous: null };
    }

    if (change.type !== "upsert_page") {
      return { ok: false, error: `Sanity adapter cannot perform "${(change as { type: string }).type}".`, retryable: false };
    }

    const id = docId(documentType, change.slug);
    const doc = {
      _id: id,
      _type: documentType,
      title: change.title,
      slug: { _type: "slug", current: change.slug },
      description: change.metaDescription,
      body: change.bodyMarkdown,
    };
    const r = await sanityMutate(ctx, [{ createOrReplace: doc }]);
    if (!r.ok) {
      return {
        ok: false,
        error: (r.body as { error?: { description?: string } } | null)?.error?.description || r.error || "Publish failed",
        retryable: r.status >= 500,
      };
    }
    return { ok: true, remoteId: id, url: `sanity://document/${id}`, previous: { canaryCandidate: true } };
  },
};

/** Read a document by id and confirm canary tokens are present (Prove). */
export async function sanityDocumentContains(
  ctx: AdapterContext,
  documentId: string,
  titleToken: string,
  bodyToken: string
): Promise<boolean> {
  const q = `*[_id == "${documentId}"][0]{ title, description, body }`;
  const r = await sanityQuery(ctx, q);
  if (!r.ok) return false;
  const doc = (r.body as { result?: { title?: string; description?: string; body?: string } } | null)?.result;
  if (!doc) return false;
  const blob = `${doc.title || ""} ${doc.description || ""} ${doc.body || ""}`;
  return blob.includes(titleToken) && blob.includes(bodyToken);
}
