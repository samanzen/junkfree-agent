/**
 * Website Adapter facade — agents call this layer, not platform APIs.
 *
 * Today most operations delegate to existing PublishAdapter implementations
 * (lib/execution/adapters/*). managed_pages wraps the proxy adapter.
 * github is a safe stub: analyze → propose → approve → PR (not auto-edit prod).
 */

import type { Brand } from "../brands";
import { getAdapter } from "../execution/registry";
import type {
  AdapterContext,
  PublishAdapter,
  PublishResult,
  SiteChange,
} from "../execution/types";
import type { WebsiteAdapterId, WebsiteCapability } from "./capabilities";
import { DEFAULT_MANAGED_NAMESPACE } from "./capabilities";

export type WebsiteAdapterMeta = {
  id: WebsiteAdapterId;
  /** Advanced / internal label. */
  label: string;
  /** Underlying SitePlatform when one exists. */
  platform: "wordpress" | "shopify" | "webhook" | "proxy" | null;
  capabilities: readonly WebsiteCapability[];
};

const METAS: Record<WebsiteAdapterId, WebsiteAdapterMeta> = {
  wordpress: {
    id: "wordpress",
    label: "WordPress",
    platform: "wordpress",
    capabilities: ["read_site", "create_page", "create_blog_post", "update_page"],
  },
  shopify: {
    id: "shopify",
    label: "Shopify",
    platform: "shopify",
    capabilities: ["read_site", "create_page"],
  },
  webhook: {
    id: "webhook",
    label: "Custom-coded site",
    platform: "webhook",
    capabilities: ["read_site", "create_page"],
  },
  managed_pages: {
    id: "managed_pages",
    label: "Volo Managed Pages",
    platform: "proxy",
    capabilities: ["read_site", "create_page", "managed_pages", "manage_sitemap"],
  },
  github: {
    id: "github",
    label: "GitHub / custom code",
    platform: null,
    capabilities: ["read_site"],
  },
};

export function websiteAdapterMeta(id: WebsiteAdapterId): WebsiteAdapterMeta {
  return METAS[id];
}

export function listWebsiteAdapters(): WebsiteAdapterMeta[] {
  return Object.values(METAS);
}

/** Map public adapter id → existing PublishAdapter when applicable. */
export function publishAdapterFor(id: WebsiteAdapterId): PublishAdapter | null {
  const platform = METAS[id].platform;
  if (!platform) return null;
  return getAdapter(platform);
}

/**
 * Prefer the best supported publish path for a content intent.
 * Content strategy decides *what* to create; this picks *how*.
 */
export function resolvePublishMethod(opts: {
  intent: "page" | "blog_post" | "meta" | "managed_page";
  available: WebsiteAdapterId[];
}): WebsiteAdapterId | null {
  const { intent, available } = opts;
  const has = (id: WebsiteAdapterId) => available.includes(id);

  if (intent === "blog_post") {
    if (has("wordpress")) return "wordpress";
    if (has("managed_pages")) return "managed_pages";
    return null;
  }
  if (intent === "meta") {
    if (has("wordpress")) return "wordpress";
    if (has("shopify")) return "shopify";
    return null;
  }
  if (intent === "managed_page") {
    return has("managed_pages") ? "managed_pages" : null;
  }
  // page
  if (has("wordpress")) return "wordpress";
  if (has("shopify")) return "shopify";
  if (has("webhook")) return "webhook";
  if (has("managed_pages")) return "managed_pages";
  if (has("github")) return "github";
  return null;
}

export async function applyViaWebsiteAdapter(
  id: WebsiteAdapterId,
  ctx: AdapterContext,
  change: SiteChange
): Promise<PublishResult> {
  if (id === "github") {
    return {
      ok: false,
      error:
        "GitHub publishing uses analyze → propose → approval → pull request. Automatic production edits are not enabled.",
      retryable: false,
    };
  }
  const adapter = publishAdapterFor(id);
  if (!adapter) {
    return { ok: false, error: `No publisher for ${id}.`, retryable: false };
  }
  return adapter.apply(ctx, change);
}

/** Build proxy/managed_pages adapter context from brand columns. */
export function managedPagesContext(brand: Brand): AdapterContext {
  return {
    brand,
    credentials: { siteToken: brand.proxy_site_token || "" },
    config: {
      namespace: brand.proxy_namespace || DEFAULT_MANAGED_NAMESPACE,
      siteUrl: brand.site_url,
    },
  };
}
