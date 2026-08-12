// SHOPIFY ADAPTER — publishes Online Store pages via the Admin REST API.
//
// Auth is a custom-app Admin API access token (shpat_…). The merchant creates
// a custom app in Shopify admin, grants write_content / read_content (and
// optionally write_products for product SEO later), then pastes the token.
//
// Credentials: { accessToken }
// Config:      { shop: "mystore.myshopify.com", status?: "publish" | "draft" }
//
// Capability note: claims "upsert_page" only. Meta description on Shopify
// Online Store pages is not a first-class core field the same way for every
// theme; we put an excerpt-style summary in the page body lead when present
// rather than guessing theme metafields.

import type { AdapterContext, PublishAdapter, PublishResult, SiteChange } from "../types";
import { markdownToHtml, excerptFrom } from "../markdown";

type ShopifyPage = {
  id?: number;
  handle?: string;
  title?: string;
  body_html?: string;
  published_at?: string | null;
};

function shopHost(ctx: AdapterContext): string | null {
  const raw = String(ctx.config.shop || "").trim().toLowerCase();
  if (!raw) return null;
  const host = raw
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.myshopify\.com$/i, "");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(host)) return null;
  return `${host}.myshopify.com`;
}

function token(ctx: AdapterContext): string | null {
  const t = (ctx.credentials.accessToken || "").trim();
  return t || null;
}

async function shopifyFetch(
  ctx: AdapterContext,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const host = shopHost(ctx);
  const accessToken = token(ctx);
  if (!host) return { ok: false, status: 0, body: null, error: "shop must be a myshopify subdomain (e.g. mystore.myshopify.com)" };
  if (!accessToken) return { ok: false, status: 0, body: null, error: "Admin API access token is required" };

  try {
    const res = await fetch(`https://${host}/admin/api/2024-10${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "SEO-Platform-Publisher",
      },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function shopifyError(r: { status: number; body: unknown; error?: string }): string {
  if (r.error) return r.error;
  const b = r.body as { errors?: string | Record<string, string[]> } | null;
  if (typeof b?.errors === "string") return b.errors;
  if (b?.errors && typeof b.errors === "object") {
    return Object.entries(b.errors)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("; ");
  }
  return `Shopify returned HTTP ${r.status}`;
}

function pageHandle(slug: string): string {
  return slug.replace(/^blog\//, "").replace(/^\/+|\/+$/g, "").toLowerCase() || "page";
}

export const shopifyAdapter: PublishAdapter = {
  provider: "shopify",
  label: "Shopify",
  capabilities: ["upsert_page"],

  async check(ctx) {
    const r = await shopifyFetch(ctx, "/shop.json");
    if (!r.ok) return { ok: false, detail: shopifyError(r) };
    const shop = (r.body as { shop?: { name?: string; domain?: string } } | null)?.shop;
    if (!shop?.name) {
      return {
        ok: false,
        detail:
          "That response was not a Shopify Admin shop resource. Confirm the store subdomain and Admin API token.",
      };
    }
    return { ok: true, detail: `Connected to ${shop.name}${shop.domain ? ` (${shop.domain})` : ""}.` };
  },

  async apply(ctx, change: SiteChange): Promise<PublishResult> {
    if (change.type !== "upsert_page") {
      return { ok: false, error: "Shopify adapter only supports upsert_page.", retryable: false };
    }

    const handle = pageHandle(change.slug);
    const html = markdownToHtml(change.bodyMarkdown);
    const summary = change.metaDescription || excerptFrom(change.bodyMarkdown);
    const bodyHtml = summary
      ? `<p><em>${escapeHtml(summary)}</em></p>\n${html}`
      : html;
    const published = ((ctx.config.status as string) || "publish") !== "draft";

    const find = await shopifyFetch(ctx, `/pages.json?handle=${encodeURIComponent(handle)}&limit=1`);
    if (!find.ok && find.status !== 404) {
      return { ok: false, error: shopifyError(find), retryable: find.status >= 500 || find.status === 429 };
    }
    const existing = ((find.body as { pages?: ShopifyPage[] } | null)?.pages || [])[0] || null;

    const payload = {
      page: {
        title: change.title,
        handle,
        body_html: bodyHtml,
        published,
      },
    };

    if (existing?.id) {
      const upd = await shopifyFetch(ctx, `/pages/${existing.id}.json`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (!upd.ok) {
        return { ok: false, error: shopifyError(upd), retryable: upd.status >= 500 || upd.status === 429 };
      }
      const page = (upd.body as { page?: ShopifyPage } | null)?.page;
      return {
        ok: true,
        remoteId: page?.id != null ? String(page.id) : String(existing.id),
        url: pageUrl(ctx, page?.handle || handle),
        previous: {
          title: existing.title || null,
          handle: existing.handle || null,
          body_html: existing.body_html || null,
        },
      };
    }

    const create = await shopifyFetch(ctx, "/pages.json", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!create.ok) {
      return { ok: false, error: shopifyError(create), retryable: create.status >= 500 || create.status === 429 };
    }
    const page = (create.body as { page?: ShopifyPage } | null)?.page;
    return {
      ok: true,
      remoteId: page?.id != null ? String(page.id) : null,
      url: pageUrl(ctx, page?.handle || handle),
      previous: null,
    };
  },
};

function pageUrl(ctx: AdapterContext, handle: string): string | null {
  const host = shopHost(ctx);
  if (!host) return null;
  // Primary domain may differ; myshopify host is always a valid absolute URL.
  return `https://${host}/pages/${handle}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
