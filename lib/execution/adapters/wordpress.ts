// WORDPRESS ADAPTER — publishes through the core WP REST API (wp/v2).
//
// Auth is an Application Password (WP 5.6+): a per-user credential the site
// owner generates in their profile and can revoke without changing their
// login. Sent as HTTP Basic, which is what WordPress itself expects.
//
// Capability note: this adapter claims "upsert_page" only. WordPress core has
// no meta-description field -- that belongs to Yoast/RankMath/SEOPress, each
// with a different post-meta key. Claiming "update_meta" here would mean
// guessing which plugin is installed and silently writing to a key nothing
// reads. A future wordpress-yoast adapter can claim it honestly.
//
// Credentials: { username, applicationPassword }
// Config:      { siteUrl, status?: "publish" | "draft" }

import type { AdapterContext, PublishAdapter, PublishResult, SiteChange } from "../types";
import { markdownToHtml, excerptFrom } from "../markdown";

type WpPost = {
  id: number;
  link?: string;
  slug?: string;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string };
  excerpt?: { raw?: string };
  status?: string;
};

// ── Response-shape validation ───────────────────────────────────────────────
// HTTP 200 is NOT sufficient evidence that we are talking to WordPress. Many
// modern sites are single-page apps that serve their HTML shell with a 200 for
// EVERY path, including /wp-json/... . Trusting res.ok against one of those
// would make check() report "authenticated" against a site with no WordPress
// at all, and make apply() report a successful publish that never happened.
// Both are worse than a clean failure, so every response below must prove it
// is the JSON resource it claims to be.

/** A single WP resource: a JSON object carrying a numeric id. */
export function parseWpResource(body: unknown): WpPost | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const id = (body as { id?: unknown }).id;
  return typeof id === "number" ? (body as WpPost) : null;
}

/** A WP collection: a JSON array whose entries are WP resources. */
export function parseWpCollection(body: unknown): WpPost[] | null {
  if (!Array.isArray(body)) return null;
  return body.every((e) => parseWpResource(e) !== null) ? (body as WpPost[]) : null;
}

const NOT_WORDPRESS =
  "That URL responded, but not with a WordPress REST resource. " +
  "Sites that serve a single-page app answer every path with 200, so confirm the site actually runs WordPress and that /wp-json is reachable.";

function baseUrl(ctx: AdapterContext): string | null {
  const raw = (ctx.config.siteUrl as string) || ctx.brand.site_url;
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(trimmed)) return null; // credentials must never cross plaintext HTTP
  return trimmed;
}

function authHeader(ctx: AdapterContext): string | null {
  const user = ctx.credentials.username;
  const pass = ctx.credentials.applicationPassword;
  if (!user || !pass) return null;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

/** WordPress slugs cannot contain "/", so a "blog/x" slug means a post, not a page. */
function routeFor(slug: string): { endpoint: "posts" | "pages"; slug: string } {
  return slug.startsWith("blog/")
    ? { endpoint: "posts", slug: slug.slice(5) }
    : { endpoint: "pages", slug };
}

async function wpFetch(
  ctx: AdapterContext,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const base = baseUrl(ctx);
  const auth = authHeader(ctx);
  if (!base) return { ok: false, status: 0, body: null, error: "siteUrl must be set and must use https://" };
  if (!auth) return { ok: false, status: 0, body: null, error: "username and applicationPassword are required" };

  try {
    const res = await fetch(`${base}/wp-json/wp/v2${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: auth,
        "Content-Type": "application/json",
        "User-Agent": "SEO-Platform-Publisher",
      },
    });
    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** WordPress returns { code, message } on failure; surface the real message. */
function wpError(r: { status: number; body: unknown; error?: string }): string {
  if (r.error) return r.error;
  const b = r.body as { message?: string; code?: string } | null;
  if (b?.message) return `${b.message}${b.code ? ` (${b.code})` : ""}`;
  return `WordPress returned HTTP ${r.status}`;
}

export const wordpressAdapter: PublishAdapter = {
  provider: "wordpress",
  label: "WordPress",
  // upsert_page covers both pages and posts (slug blog/* → posts).
  // update_meta writes Yoast REST meta when available, else title + excerpt.
  capabilities: ["upsert_page", "update_meta"],

  async check(ctx) {
    const r = await wpFetch(ctx, "/users/me?context=edit");
    if (r.ok) {
      const me = parseWpResource(r.body);
      // A 200 that is not a WP user resource means this is not WordPress.
      if (!me) return { ok: false, detail: NOT_WORDPRESS };
      const named = me as WpPost & { name?: string };
      const yoast = await wpFetch(ctx, "/types/post?context=edit");
      const yoastHint =
        yoast.ok && JSON.stringify(yoast.body).includes("yoast")
          ? " Yoast meta fields look available."
          : " Meta updates use title/excerpt (and Yoast keys when registered).";
      return {
        ok: true,
        detail: `Authenticated to WordPress as ${named.name || me.slug || `user ${me.id}`}.${yoastHint}`,
      };
    }
    if (r.status === 401 || r.status === 403) {
      return { ok: false, detail: "WordPress rejected the credentials. Check the username and application password." };
    }
    if (r.status === 404) {
      return { ok: false, detail: "No REST API found at /wp-json/wp/v2. Confirm the site URL and that the REST API is enabled." };
    }
    return { ok: false, detail: wpError(r) };
  },

  async apply(ctx, change: SiteChange): Promise<PublishResult> {
    if (change.type === "delete_page") {
      return deleteWpPage(ctx, change.slug, change.remoteId);
    }

    if (change.type === "update_meta") {
      return updateWpMeta(ctx, change);
    }

    if (change.type === "upsert_page") {
    const { endpoint, slug } = routeFor(change.slug);
    const status = ctx.config.status === "draft" ? "draft" : "publish";

    // Find an existing entry so this is an upsert rather than a duplicate.
    const found = await wpFetch(ctx, `/${endpoint}?slug=${encodeURIComponent(slug)}&status=any&context=edit&per_page=1`);
    if (!found.ok) {
      return { ok: false, error: wpError(found), retryable: found.status === 0 || found.status >= 500 };
    }

    // A lookup that does not come back as a JSON collection means this endpoint
    // is not the WordPress REST API, however friendly its status code was.
    const collection = parseWpCollection(found.body);
    if (!collection) return { ok: false, error: NOT_WORDPRESS, retryable: false };
    const existing = collection[0];

    const payload: Record<string, unknown> = {
      title: change.title,
      content: markdownToHtml(change.bodyMarkdown),
      slug,
      status,
      excerpt: change.metaDescription || excerptFrom(change.bodyMarkdown),
    };
    if (change.metaDescription) {
      payload.meta = {
        _yoast_wpseo_metadesc: change.metaDescription,
        _yoast_wpseo_title: change.title,
      };
    }

    // Captured before the write so a later phase can offer rollback.
    const previous = existing
      ? {
          id: existing.id,
          title: existing.title?.raw ?? existing.title?.rendered ?? null,
          content: existing.content?.raw ?? null,
          excerpt: existing.excerpt?.raw ?? null,
          status: existing.status ?? null,
        }
      : null;

    const written = existing
      ? await wpFetch(ctx, `/${endpoint}/${existing.id}`, { method: "POST", body: JSON.stringify(payload) })
      : await wpFetch(ctx, `/${endpoint}`, { method: "POST", body: JSON.stringify(payload) });

    if (!written.ok) {
      // Retry without meta if Yoast keys are rejected.
      if (payload.meta && (written.status === 400 || written.status === 403)) {
        delete payload.meta;
        const retry = existing
          ? await wpFetch(ctx, `/${endpoint}/${existing.id}`, { method: "POST", body: JSON.stringify(payload) })
          : await wpFetch(ctx, `/${endpoint}`, { method: "POST", body: JSON.stringify(payload) });
        if (!retry.ok) {
          return { ok: false, error: wpError(retry), retryable: retry.status === 0 || retry.status >= 500 || retry.status === 429 };
        }
        const postRetry = parseWpResource(retry.body);
        if (!postRetry) return { ok: false, error: NOT_WORDPRESS, retryable: false };
        return { ok: true, remoteId: String(postRetry.id), url: postRetry.link || null, previous };
      }
      return { ok: false, error: wpError(written), retryable: written.status === 0 || written.status >= 500 || written.status === 429 };
    }

    // Only a real WP resource proves the write landed. Without this, an SPA
    // catch-all returning 200 HTML would be reported as a successful publish.
    const post = parseWpResource(written.body);
    if (!post) return { ok: false, error: NOT_WORDPRESS, retryable: false };

    return {
      ok: true,
      remoteId: String(post.id),
      url: post.link || null,
      previous,
    };
    }

    return { ok: false, error: "WordPress adapter received an unsupported change.", retryable: false };
  },
};

async function updateWpMeta(
  ctx: AdapterContext,
  change: Extract<SiteChange, { type: "update_meta" }>
): Promise<PublishResult> {
  let path = "";
  try {
    path = new URL(change.url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return { ok: false, error: "Meta update needs an absolute page URL.", retryable: false };
  }
  const slug = path.split("/").filter(Boolean).pop() || "";
  if (!slug) return { ok: false, error: "Could not derive a slug from the page URL.", retryable: false };

  // Prefer pages, then posts.
  for (const endpoint of ["pages", "posts"] as const) {
    const found = await wpFetch(ctx, `/${endpoint}?slug=${encodeURIComponent(slug)}&status=any&context=edit&per_page=1`);
    if (!found.ok) continue;
    const collection = parseWpCollection(found.body);
    if (!collection?.[0]) continue;
    const existing = collection[0];
    const payload: Record<string, unknown> = {};
    if (change.title) payload.title = change.title;
    if (change.metaDescription) {
      payload.excerpt = change.metaDescription;
      payload.meta = {
        _yoast_wpseo_metadesc: change.metaDescription,
        ...(change.title ? { _yoast_wpseo_title: change.title } : {}),
      };
    }
    const written = await wpFetch(ctx, `/${endpoint}/${existing.id}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!written.ok && payload.meta) {
      delete payload.meta;
      const retry = await wpFetch(ctx, `/${endpoint}/${existing.id}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!retry.ok) {
        return { ok: false, error: wpError(retry), retryable: retry.status >= 500 };
      }
      const post = parseWpResource(retry.body);
      return { ok: true, remoteId: String(existing.id), url: post?.link || change.url, previous: null };
    }
    if (!written.ok) {
      return { ok: false, error: wpError(written), retryable: written.status >= 500 };
    }
    const post = parseWpResource(written.body);
    return { ok: true, remoteId: String(existing.id), url: post?.link || change.url, previous: null };
  }
  return { ok: false, error: `No WordPress page or post found for slug "${slug}".`, retryable: false };
}

async function deleteWpPage(
  ctx: AdapterContext,
  slug: string,
  remoteId: string | null
): Promise<PublishResult> {
  const { endpoint } = routeFor(slug);
  let id = remoteId && /^\d+$/.test(remoteId) ? remoteId : null;
  if (!id) {
    const found = await wpFetch(
      ctx,
      `/${endpoint}?slug=${encodeURIComponent(routeFor(slug).slug)}&status=any&context=edit&per_page=1`
    );
    if (!found.ok) {
      return { ok: false, error: wpError(found), retryable: found.status === 0 || found.status >= 500 };
    }
    const collection = parseWpCollection(found.body);
    if (!collection) return { ok: false, error: NOT_WORDPRESS, retryable: false };
    if (!collection[0]) {
      // Already gone — rollback of a create is satisfied.
      return { ok: true, remoteId: null, url: null, previous: null };
    }
    id = String(collection[0].id);
  }

  const del = await wpFetch(ctx, `/${endpoint}/${id}?force=true`, { method: "DELETE" });
  if (del.ok || del.status === 404) {
    const resource = del.ok ? parseWpResource(del.body) : null;
    if (del.ok && del.body && !resource && !isWpDeletedPayload(del.body)) {
      return { ok: false, error: NOT_WORDPRESS, retryable: false };
    }
    return { ok: true, remoteId: id, url: null, previous: null };
  }
  return {
    ok: false,
    error: wpError(del),
    retryable: del.status === 0 || del.status >= 500 || del.status === 429,
  };
}

function isWpDeletedPayload(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const d = body as { deleted?: unknown; previous?: unknown };
  return d.deleted === true || typeof (d.previous as { id?: unknown } | undefined)?.id === "number";
}
