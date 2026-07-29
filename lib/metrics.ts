import { db } from "./supabase";
import type { Brand } from "./brands";
import { strikingDistance } from "./gsc";
import { domainOverview, backlinksSummary, rankedKeywords, isConfigured } from "./dataforseo";

export type Snapshot = {
  organic_traffic: number | null;
  organic_keywords: number | null;
  backlinks: number | null;
  referring_domains: number | null;
  striking_distance: number | null;
  avg_position: number | null;
  ai_visibility: number | null;
  site_health: number | null;
};

function domainOf(brand: Brand) {
  return brand.site_url.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "");
}

// Lightweight snapshot — only DataForSEO + GSC (fast, under 30s).
export async function snapshot(brand: Brand): Promise<Snapshot> {
  const domain = domainOf(brand);
  const gsc = brand.gsc_property;

  const [striking, overview, backlinks, ranked] = await Promise.all([
    gsc ? strikingDistance(gsc).catch(() => []) : Promise.resolve([]),
    isConfigured() ? domainOverview(domain).catch(() => null) : Promise.resolve(null),
    isConfigured() ? backlinksSummary(domain).catch(() => null) : Promise.resolve(null),
    isConfigured() ? rankedKeywords(domain).catch(() => []) : Promise.resolve([]),
  ]);

  let strikingCount = striking.length;
  let avgPos = striking.length
    ? striking.reduce((s, r) => s + r.position, 0) / striking.length
    : null;
  if (!strikingCount && ranked.length) {
    strikingCount = ranked.filter((k) => k.position >= 4 && k.position <= 20).length;
    const positions = ranked.map((k) => k.position).filter((p) => p > 0);
    avgPos = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
  }

  const snap: Snapshot = {
    organic_traffic: overview?.organic_traffic ?? null,
    organic_keywords: overview?.organic_keywords ?? null,
    backlinks: backlinks?.backlinks ?? null,
    referring_domains: backlinks?.referring_domains ?? null,
    striking_distance: strikingCount || null,
    avg_position: avgPos ? Math.round(avgPos * 10) / 10 : null,
    ai_visibility: null,
    site_health: null,
  };

  await db.from("metric_snapshots").insert({
    brand_id: brand.id, ...snap, captured_at: new Date().toISOString(),
  });
  return snap;
}

export async function series(brandId: string, limit = 30) {
  const { data } = await db.from("metric_snapshots").select("*")
    .eq("brand_id", brandId).order("captured_at", { ascending: true }).limit(limit);
  return data || [];
}

export async function latestWithDelta(brandId: string) {
  const { data } = await db.from("metric_snapshots").select("*")
    .eq("brand_id", brandId).order("captured_at", { ascending: false }).limit(2);
  return { current: data?.[0] || null, previous: data?.[1] || null };
}
