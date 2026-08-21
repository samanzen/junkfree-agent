// PROXY ADAPTER — subdirectory rewrite publishing.
//
// No brand_integrations row. Credentials/config come from brands columns:
//   credentials: { siteToken }
//   config:      { namespace, siteUrl }
//
// Pages are stored in `content` and served by app/s/[token]/[...path].
// Public URLs are https://{customer-host}/{namespace}/{slug} via CDN rewrite.

import { db } from "../../supabase";
import { contentPublishFields } from "../../content-publish";
import { absolutePageUrl } from "../../publish-check";
import type { AdapterContext, PublishAdapter, PublishResult, SiteChange } from "../types";
import { isProxySiteToken, isProxyNamespace } from "../proxy-token";

function namespaceOf(ctx: AdapterContext): string {
  return String(ctx.config.namespace || "").trim();
}

export const proxyAdapter: PublishAdapter = {
  provider: "proxy",
  label: "Subdirectory on your site",
  capabilities: ["upsert_page"],

  async check(ctx) {
    const token = (ctx.credentials.siteToken || "").trim();
    const namespace = namespaceOf(ctx);
    if (!isProxySiteToken(token)) {
      return { ok: false, detail: "Publishing token is missing or invalid. Reconnect website publishing." };
    }
    if (!isProxyNamespace(namespace)) {
      return { ok: false, detail: "Choose a path name for new pages (for example guides)." };
    }
    return {
      ok: true,
      detail: `Pages under /${namespace}/ will be served through this connection once publishing is proven.`,
    };
  },

  async apply(ctx, change: SiteChange): Promise<PublishResult> {
    if (change.type === "update_meta") {
      return {
        ok: false,
        error: "Editing existing pages needs a CMS connection (WordPress or Shopify).",
        retryable: false,
      };
    }

    const namespace = namespaceOf(ctx);
    if (!isProxyNamespace(namespace)) {
      return { ok: false, error: "Path name for new pages is missing.", retryable: false };
    }

    if (change.type === "delete_page") {
      const slug = change.slug || change.remoteId;
      if (!slug) return { ok: false, error: "Missing slug to delete.", retryable: false };
      const { error } = await db.from("content").delete().eq("brand_id", ctx.brand.id).eq("slug", slug);
      if (error) return { ok: false, error: error.message, retryable: true };
      return { ok: true, remoteId: slug, url: null, previous: null };
    }

    if (change.type !== "upsert_page") {
      return { ok: false, error: `Proxy adapter cannot perform "${(change as { type: string }).type}".`, retryable: false };
    }

    const { error } = await db.from("content").upsert(
      contentPublishFields({
        slug: change.slug,
        brandId: ctx.brand.id,
        title: change.title,
        body: change.bodyMarkdown,
        metaDescription: change.metaDescription,
      }),
      { onConflict: "brand_id,slug" }
    );
    if (error) return { ok: false, error: error.message, retryable: true };

    const url = absolutePageUrl(ctx.brand.site_url, `${namespace}/${change.slug}`);
    return {
      ok: true,
      remoteId: change.slug,
      url,
      previous: { canaryCandidate: true },
    };
  },
};
