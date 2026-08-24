// ADAPTER REGISTRY — the only place that knows which platforms exist.
//
// Adding a platform is: write the adapter file, import it here, add it to
// ADAPTERS, and extend SitePlatform in types.ts. No route, job, engine or UI
// code changes. That is the whole contract.

import type { PublishAdapter, SitePlatform } from "./types";
import { wordpressAdapter } from "./adapters/wordpress";
import { shopifyAdapter } from "./adapters/shopify";
import { webhookAdapter } from "./adapters/webhook";
import { proxyAdapter } from "./adapters/proxy";
import { githubAdapter } from "./adapters/github";
import { sanityAdapter } from "./adapters/sanity";

const ADAPTERS: Record<SitePlatform, PublishAdapter> = {
  wordpress: wordpressAdapter,
  shopify: shopifyAdapter,
  webhook: webhookAdapter,
  proxy: proxyAdapter,
  github: githubAdapter,
  sanity: sanityAdapter,
};

/** Every platform the engine can publish to today. */
export const SITE_PLATFORMS = Object.keys(ADAPTERS) as SitePlatform[];

/** Writers stored in brand_integrations (proxy uses brands columns instead). */
export const INTEGRATION_SITE_PLATFORMS = SITE_PLATFORMS.filter(
  (p): p is Exclude<SitePlatform, "proxy"> => p !== "proxy"
);

export function isSitePlatform(value: unknown): value is SitePlatform {
  return typeof value === "string" && (SITE_PLATFORMS as string[]).includes(value);
}

export function getAdapter(platform: SitePlatform): PublishAdapter {
  return ADAPTERS[platform];
}

/** Capability catalogue, for the status endpoint and any future settings UI. */
export function describeAdapters() {
  return SITE_PLATFORMS.map((p) => ({
    provider: p,
    label: ADAPTERS[p].label,
    capabilities: [...ADAPTERS[p].capabilities],
  }));
}
