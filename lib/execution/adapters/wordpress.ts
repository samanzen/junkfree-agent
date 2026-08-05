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
  capabilities: ["upsert_page"],

  async check(ctx) {
    const r = await wpFetch(ctx, "/users/me?context=edit");
    if (r.ok) {
      const me = parseWpResource(r.body);
      // A 200 that is not a WP user resource means this is not WordPress.
      if (!me) return { ok: false, detail: NOT_WORDPRESS };
      const named = me as WpPost & { name?: string };
      return { ok: true, detail: `Authenticated to WordPress as ${named.name || me.slug || `user ${me.id}`}.` };
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
    if (change.type !== "upsert_page") {
      return { ok: false, error: `WordPress adapter cannot perform "${change.type}".`, retryable: false };
    }

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

    const payload = {
      title: change.title,
      content: markdownToHtml(change.bodyMarkdown),
      slug,
      status,
      excerpt: change.metaDescription || excerptFrom(change.bodyMarkdown),
    };

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
  },
};
