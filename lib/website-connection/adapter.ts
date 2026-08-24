/**
 * Website Adapter facade — agents call this layer, not platform APIs.
 *
 * Delegates to PublishAdapter implementations in lib/execution/adapters/*.
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
  label: string;
  platform: "wordpress" | "shopify" | "webhook" | "proxy" | "github" | "sanity" | null;
  capabilities: readonly WebsiteCapability[];
};

const METAS: Record<WebsiteAdapterId, WebsiteAdapterMeta> = {
  wordpress: {
    id: "wordpress",
    label: "WordPress",
    platform: "wordpress",
    capabilities: ["read_site", "create_page", "create_blog_post", "update_page", "update_meta"],
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
    label: "GitHub",
    platform: "github",
    capabilities: ["read_site", "create_page", "create_blog_post", "update_page", "update_meta"],
  },
  sanity: {
    id: "sanity",
    label: "Sanity",
    platform: "sanity",
    capabilities: ["read_site", "create_page", "update_page", "update_meta"],
  },
};

export function websiteAdapterMeta(id: WebsiteAdapterId): WebsiteAdapterMeta {
  return METAS[id];
}

export function listWebsiteAdapters(): WebsiteAdapterMeta[] {
  return Object.values(METAS);
}

export function publishAdapterFor(id: WebsiteAdapterId): PublishAdapter | null {
  const platform = METAS[id].platform;
  if (!platform) return null;
  return getAdapter(platform);
}

export function resolvePublishMethod(opts: {
  intent: "page" | "blog_post" | "meta" | "managed_page";
  available: WebsiteAdapterId[];
}): WebsiteAdapterId | null {
  const { intent, available } = opts;
  const has = (id: WebsiteAdapterId) => available.includes(id);

  if (intent === "blog_post") {
    if (has("wordpress")) return "wordpress";
    if (has("github")) return "github";
    if (has("sanity")) return "sanity";
    if (has("managed_pages")) return "managed_pages";
    return null;
  }
  if (intent === "meta") {
    if (has("wordpress")) return "wordpress";
    if (has("github")) return "github";
    if (has("sanity")) return "sanity";
    return null;
  }
  if (intent === "managed_page") {
    return has("managed_pages") ? "managed_pages" : null;
  }
  if (has("wordpress")) return "wordpress";
  if (has("shopify")) return "shopify";
  if (has("sanity")) return "sanity";
  if (has("github")) return "github";
  if (has("webhook")) return "webhook";
  if (has("managed_pages")) return "managed_pages";
  return null;
}

export async function applyViaWebsiteAdapter(
  id: WebsiteAdapterId,
  ctx: AdapterContext,
  change: SiteChange
): Promise<PublishResult> {
  const adapter = publishAdapterFor(id);
  if (!adapter) {
    return { ok: false, error: `No publisher for ${id}.`, retryable: false };
  }
  return adapter.apply(ctx, change);
}

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
