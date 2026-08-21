// SHOPIFY ADAPTER — Online Store pages via the GraphQL Admin API.
//
// REST Admin API is legacy (Oct 2024). This adapter talks to GraphQL 2026-07.
// Auth is unchanged: a custom-app Admin token (shpat_…) in brand_integrations,
// sent as X-Shopify-Access-Token. No Shopify SDK, no second architecture.
//
// Credentials: { accessToken }
// Config:      { shop: "mystore.myshopify.com", status?: "publish" | "draft" }
//
// Claims "upsert_page" only. Theme metafields for meta description are not
// a stable core field, so we put the summary in the page body lead rather
// than guessing a metafield the theme may not read.

import type { AdapterContext, PublishAdapter, PublishResult, SiteChange } from "../types";
import { markdownToHtml, excerptFrom } from "../markdown";

/** Current stable Admin API as of August 2026. Never use `latest`. */
export const SHOPIFY_ADMIN_API_VERSION = "2026-07";

type GqlUserError = { field?: string[] | null; message?: string | null };
type GqlPage = { id?: string; title?: string; handle?: string; body?: string; isPublished?: boolean };

export function shopHost(ctx: AdapterContext): string | null {
  const raw = String(ctx.config.shop || "").trim().toLowerCase();
  if (!raw) return null;
  const host = raw
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.myshopify\.com$/i, "");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(host)) return null;
  return `${host}.myshopify.com`;
}

export function shopifyPageGid(id: string | null | undefined): string | null {
  if (!id) return null;
  const t = id.trim();
  if (!t) return null;
  if (t.startsWith("gid://")) return t;
  if (/^\d+$/.test(t)) return `gid://shopify/Page/${t}`;
  return t;
}

function token(ctx: AdapterContext): string | null {
  const t = (ctx.credentials.accessToken || "").trim();
  return t || null;
}

type GqlResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  errors: { message?: string; extensions?: { code?: string } }[] | null;
  error?: string;
};

async function shopifyGraphql(
  ctx: AdapterContext,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<GqlResult> {
  const host = shopHost(ctx);
  const accessToken = token(ctx);
  if (!host) {
    return {
      ok: false,
      status: 0,
      data: null,
      errors: null,
      error: "shop must be a myshopify subdomain (e.g. mystore.myshopify.com)",
    };
  }
  if (!accessToken) {
    return { ok: false, status: 0, data: null, errors: null, error: "Admin access token is required" };
  }

  try {
    const res = await fetch(`https://${host}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "SEO-Platform-Publisher",
      },
      body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    let parsed: { data?: Record<string, unknown>; errors?: GqlResult["errors"] } | null = null;
    try {
      parsed = text ? (JSON.parse(text) as { data?: Record<string, unknown>; errors?: GqlResult["errors"] }) : null;
    } catch {
      return {
        ok: false,
        status: res.status,
        data: null,
        errors: null,
        error: "Shopify did not return a GraphQL response.",
      };
    }
    return {
      ok: res.ok,
      status: res.status,
      data: parsed?.data && typeof parsed.data === "object" ? parsed.data : null,
      errors: Array.isArray(parsed?.errors) ? parsed.errors : null,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      errors: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function accessDenied(r: GqlResult): boolean {
  if (r.status === 401 || r.status === 403) return true;
  return (r.errors || []).some((e) => /ACCESS_DENIED/i.test(e.extensions?.code || e.message || ""));
}

const SCOPE_COPY =
  "The store token can't create pages. In Shopify admin, update the custom app so it can write content, then paste a new token.";

function shopifyError(r: GqlResult, userErrors?: GqlUserError[] | null): string {
  if (accessDenied(r)) return SCOPE_COPY;
  if (r.error) return r.error;
  const fromUsers = (userErrors || []).map((e) => e.message).filter(Boolean).join("; ");
  if (fromUsers) return fromUsers;
  const fromGql = (r.errors || []).map((e) => e.message).filter(Boolean).join("; ");
  if (fromGql) return fromGql;
  if (!r.ok) return `Shopify returned HTTP ${r.status}`;
  return "Shopify refused the change.";
}

function pageHandle(slug: string): string {
  return slug.replace(/^blog\//, "").replace(/^\/+|\/+$/g, "").toLowerCase() || "page";
}

function publicPageUrl(ctx: AdapterContext, handle: string, primaryUrl?: string | null): string | null {
  const site = (ctx.brand.site_url || "").trim();
  if (site) {
    try {
      const origin = new URL(site).origin;
      return `${origin}/pages/${handle}`;
    } catch {
      /* fall through */
    }
  }
  if (primaryUrl) {
    try {
      return `${new URL(primaryUrl).origin}/pages/${handle}`;
    } catch {
      /* fall through */
    }
  }
  const host = shopHost(ctx);
  return host ? `https://${host}/pages/${handle}` : null;
}

const SHOP_QUERY = `query ShopCheck {
  shop {
    name
    primaryDomain { host url }
  }
}`;

const PAGES_QUERY = `query PagesByHandle($query: String!) {
  pages(first: 1, query: $query) {
    nodes { id title handle body isPublished }
  }
}`;

const CREATE_MUTATION = `mutation CreatePage($page: PageCreateInput!) {
  pageCreate(page: $page) {
    page { id title handle }
    userErrors { field message }
  }
}`;

const UPDATE_MUTATION = `mutation UpdatePage($id: ID!, $page: PageUpdateInput!) {
  pageUpdate(id: $id, page: $page) {
    page { id title handle }
    userErrors { field message }
  }
}`;

const DELETE_MUTATION = `mutation DeletePage($id: ID!) {
  pageDelete(id: $id) {
    deletedPageId
    userErrors { field message }
  }
}`;

export const shopifyAdapter: PublishAdapter = {
  provider: "shopify",
  label: "Shopify",
  capabilities: ["upsert_page"],

  async check(ctx) {
    const r = await shopifyGraphql(ctx, SHOP_QUERY);
    if (accessDenied(r)) return { ok: false, detail: SCOPE_COPY };
    if (!r.ok || r.error) return { ok: false, detail: shopifyError(r) };
    const shop = r.data?.shop as { name?: string; primaryDomain?: { host?: string; url?: string } } | undefined;
    if (!shop || typeof shop.name !== "string" || !shop.name) {
      return {
        ok: false,
        detail:
          "That response was not a Shopify shop. Confirm the store name and admin access token.",
      };
    }
    const domain = shop.primaryDomain?.host;
    return { ok: true, detail: `Connected to ${shop.name}${domain ? ` (${domain})` : ""}.` };
  },

  async apply(ctx, change: SiteChange): Promise<PublishResult> {
    if (change.type === "delete_page") {
      return deleteShopifyPage(ctx, change.slug, change.remoteId);
    }
    if (change.type !== "upsert_page") {
      return { ok: false, error: "Shopify adapter only supports upsert_page.", retryable: false };
    }

    const handle = pageHandle(change.slug);
    const html = markdownToHtml(change.bodyMarkdown);
    const summary = change.metaDescription || excerptFrom(change.bodyMarkdown);
    const bodyHtml = summary ? `<p><em>${escapeHtml(summary)}</em></p>\n${html}` : html;
    const published = ((ctx.config.status as string) || "publish") !== "draft";

    const found = await shopifyGraphql(ctx, PAGES_QUERY, { query: `handle:${handle}` });
    if (accessDenied(found)) return { ok: false, error: SCOPE_COPY, retryable: false };
    if (found.error || (!found.ok && found.status !== 200)) {
      return { ok: false, error: shopifyError(found), retryable: found.status >= 500 || found.status === 429 };
    }
    const existing = ((found.data?.pages as { nodes?: GqlPage[] } | undefined)?.nodes || [])[0] || null;

    if (existing?.id) {
      const upd = await shopifyGraphql(ctx, UPDATE_MUTATION, {
        id: existing.id,
        page: { title: change.title, handle, body: bodyHtml, isPublished: published },
      });
      const payload = upd.data?.pageUpdate as { page?: GqlPage; userErrors?: GqlUserError[] } | undefined;
      if (accessDenied(upd) || !upd.ok || (payload?.userErrors && payload.userErrors.length)) {
        return {
          ok: false,
          error: shopifyError(upd, payload?.userErrors),
          retryable: upd.status >= 500 || upd.status === 429,
        };
      }
      if (!payload?.page?.id) {
        return { ok: false, error: shopifyError(upd, payload?.userErrors), retryable: false };
      }
      return {
        ok: true,
        remoteId: payload.page.id,
        url: publicPageUrl(ctx, payload.page.handle || handle),
        previous: {
          title: existing.title || null,
          handle: existing.handle || null,
          body: existing.body || null,
        },
      };
    }

    const create = await shopifyGraphql(ctx, CREATE_MUTATION, {
      page: { title: change.title, handle, body: bodyHtml, isPublished: published },
    });
    const payload = create.data?.pageCreate as { page?: GqlPage; userErrors?: GqlUserError[] } | undefined;
    if (accessDenied(create) || !create.ok || (payload?.userErrors && payload.userErrors.length)) {
      return {
        ok: false,
        error: shopifyError(create, payload?.userErrors),
        retryable: !accessDenied(create) && (create.status >= 500 || create.status === 429),
      };
    }
    if (!payload?.page?.id) {
      return { ok: false, error: shopifyError(create, payload?.userErrors), retryable: false };
    }
    return {
      ok: true,
      remoteId: payload.page.id,
      url: publicPageUrl(ctx, payload.page.handle || handle),
      previous: null,
    };
  },
};

async function deleteShopifyPage(
  ctx: AdapterContext,
  slug: string,
  remoteId: string | null
): Promise<PublishResult> {
  let id = shopifyPageGid(remoteId);
  if (!id) {
    const handle = pageHandle(slug);
    const found = await shopifyGraphql(ctx, PAGES_QUERY, { query: `handle:${handle}` });
    if (accessDenied(found)) return { ok: false, error: SCOPE_COPY, retryable: false };
    const existing = ((found.data?.pages as { nodes?: GqlPage[] } | undefined)?.nodes || [])[0] || null;
    if (!existing?.id) return { ok: true, remoteId: null, url: null, previous: null };
    id = existing.id;
  }

  const del = await shopifyGraphql(ctx, DELETE_MUTATION, { id });
  const payload = del.data?.pageDelete as { deletedPageId?: string | null; userErrors?: GqlUserError[] } | undefined;
  if (accessDenied(del)) return { ok: false, error: SCOPE_COPY, retryable: false };
  if (!del.ok || (payload?.userErrors && payload.userErrors.length) || !payload?.deletedPageId) {
    // Already gone is success for rollback of a create.
    const msg = shopifyError(del, payload?.userErrors);
    if (/not found|does not exist/i.test(msg)) {
      return { ok: true, remoteId: id, url: null, previous: null };
    }
    return {
      ok: false,
      error: msg,
      retryable: del.status >= 500 || del.status === 429,
    };
  }
  return { ok: true, remoteId: payload.deletedPageId || id, url: null, previous: null };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
