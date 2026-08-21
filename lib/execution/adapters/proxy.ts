// PROXY ADAPTER — subdirectory rewrite publishing.
//
// No brand_integrations row. Credentials/config come from brands columns:
//   credentials: { siteToken }
//   config:      { namespace, siteUrl }
//
// Public origin (pub host /s/{token}/*) is the next slice. Until that ships,
// check() accepts a complete pin; apply() refuses with a clear message so
// Prove cannot falsely certify.

import type { AdapterContext, PublishAdapter, PublishResult, SiteChange } from "../types";
import { isProxySiteToken, isProxyNamespace } from "../proxy-token";

export const proxyAdapter: PublishAdapter = {
  provider: "proxy",
  label: "Subdirectory on your site",
  capabilities: ["upsert_page"],

  async check(ctx) {
    const token = (ctx.credentials.siteToken || "").trim();
    const namespace = String(ctx.config.namespace || "").trim();
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

  async apply(_ctx, change: SiteChange): Promise<PublishResult> {
    if (change.type === "update_meta") {
      return {
        ok: false,
        error: "Editing existing pages needs a CMS connection (WordPress or Shopify).",
        retryable: false,
      };
    }
    // Public origin slice writes/deletes under /{namespace}/. Not live yet.
    return {
      ok: false,
      error: "Subdirectory publishing is connected but the public page server is not live yet.",
      retryable: false,
    };
  },
};
