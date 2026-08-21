// Proxy public-origin token resolution.
//
// Hot path: every page view under /s/{token}/* looks up the brand. Cache in
// memory with a short TTL; invalidate on disconnect / token rotation.

import { db } from "../supabase";
import { isProxySiteToken } from "../execution/proxy-token";

export type ProxyBrand = {
  id: string;
  slug: string;
  name: string;
  site_url: string;
  namespace: string;
  primary_writer: string | null;
};

type CacheEntry = { brand: ProxyBrand | null; expires: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

export function invalidateProxyToken(token: string | null | undefined) {
  if (!token) return;
  cache.delete(token);
}

export function clearProxyTokenCache() {
  cache.clear();
}

export async function resolveProxyToken(token: string): Promise<ProxyBrand | null> {
  if (!isProxySiteToken(token)) return null;

  const hit = cache.get(token);
  if (hit && hit.expires > Date.now()) return hit.brand;

  const { data } = await db
    .from("brands")
    .select("id, slug, name, site_url, proxy_namespace, primary_writer, active")
    .eq("proxy_site_token", token)
    .maybeSingle();

  const brand: ProxyBrand | null =
    data && data.active !== false && typeof data.proxy_namespace === "string" && data.proxy_namespace
      ? {
          id: data.id,
          slug: data.slug,
          name: data.name,
          site_url: data.site_url,
          namespace: data.proxy_namespace,
          primary_writer: data.primary_writer,
        }
      : null;

  cache.set(token, { brand, expires: Date.now() + TTL_MS });
  return brand;
}

/**
 * Forwarded host must match the brand's registered site host.
 * Returns the customer host to use in canonicals, or null on mismatch.
 */
export function verifyHost(headers: Headers, brand: ProxyBrand): string | null {
  const raw = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  const host = raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  if (!host) return null;

  let expected: string;
  try {
    expected = new URL(brand.site_url).host.toLowerCase().replace(/:\d+$/, "");
  } catch {
    return null;
  }

  const bare = (h: string) => h.replace(/^www\./, "");
  return bare(host) === bare(expected) ? host : null;
}
