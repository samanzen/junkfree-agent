// METRICS COLLECTOR — snapshots each brand's SEO KPIs so the Overview dashboard
// can show current values AND trends over time (like Semrush's charts).
// Snapshots are stored in `metric_snapshots`. Kept cheap: run on the daily cycle.

import { db } from "./supabase";
import type { Brand } from "./brands";
import { strikingDistance, lowCtrPages } from "./gsc";
import { domainOverview, backlinksSummary, isConfigured } from "./dataforseo";

export type Snapshot = {
  organic_traffic: number | null;
  organic_keywords: number | null;
  backlinks: number | null;
  referring_domains: number | null;
  striking_distance: number | null;   // # keywords in positions 5-20
  avg_position: number | null;         // avg position across tracked queries
  ai_visibility: number | null;        // 0-100, from GEO visibility checks
  site_health: number | null;          // 0-100, from auditor
};

function domainOf(brand: Brand) {
  return brand.site_url.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "");
}

// Build and store today's snapshot for a brand.
export async function snapshot(brand: Brand): Promise<Snapshot> {
  const domain = domainOf(brand);
  const gsc = brand.gsc_property;

  const [striking, overview, backlinks] = await Promise.all([
    gsc ? strikingDistance(gsc).catch(() => []) : Promise.resolve([]),
    isConfigured() ? domainOverview(domain).catch(() => null) : Promise.resolve(null),
    isConfigured() ? backlinksSummary(domain).catch(() => null) : Promise.resolve(null),
  ]);

  const avgPos = striking.length ? striking.reduce((s, r) => s + r.position, 0) / striking.length : null;

  const snap: Snapshot = {
    organic_traffic: overview?.organic_traffic ?? null,
    organic_keywords: overview?.organic_keywords ?? null,
    backlinks: backlinks?.backlinks ?? null,
    referring_domains: backlinks?.referring_domains ?? null,
    striking_distance: striking.length || null,
    avg_position: avgPos ? Math.round(avgPos * 10) / 10 : null,
    ai_visibility: null, // filled by GEO visibility checks (separate cadence)
    site_health: null,   // filled from latest audit
  };

  // Pull latest site-health from the newest audit-derived report, if present.
  const { data: rep } = await db.from("reports").select("metrics").eq("brand_id", brand.id)
    .order("created_at", { ascending: false }).limit(1);
  const health = (rep?.[0]?.metrics as { site_health?: number } | undefined)?.site_health;
  if (typeof health === "number") snap.site_health = health;

  await db.from("metric_snapshots").insert({ brand_id: brand.id, ...snap, captured_at: new Date().toISOString() });
  return snap;
}

// Time series for the charts (last N snapshots).
export async function series(brandId: string, limit = 30) {
  const { data } = await db.from("metric_snapshots").select("*")
    .eq("brand_id", brandId).order("captured_at", { ascending: true }).limit(limit);
  return data || [];
}

// Latest snapshot + the previous one (for the +/- change badges).
export async function latestWithDelta(brandId: string) {
  const { data } = await db.from("metric_snapshots").select("*")
    .eq("brand_id", brandId).order("captured_at", { ascending: false }).limit(2);
  return { current: data?.[0] || null, previous: data?.[1] || null };
}
