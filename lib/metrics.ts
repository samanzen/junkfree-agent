// METRICS COLLECTOR — snapshots each brand's SEO KPIs so the Overview dashboard
// can show current values AND trends over time (like Semrush's charts).
// Snapshots are stored in `metric_snapshots`. Kept cheap: run on the daily cycle.

import { db } from "./supabase";
import type { Brand } from "./brands";
import { strikingDistance, lowCtrPages } from "./gsc";
import { domainOverview, backlinksSummary, rankedKeywords, isConfigured } from "./dataforseo";
import { auditSite } from "./auditor";
import { checkAiVisibility } from "./geo-agent";

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

  const [striking, overview, backlinks, ranked, audit, aiVis] = await Promise.all([
    gsc ? strikingDistance(gsc).catch(() => []) : Promise.resolve([]),
    isConfigured() ? domainOverview(domain).catch(() => null) : Promise.resolve(null),
    isConfigured() ? backlinksSummary(domain).catch(() => null) : Promise.resolve(null),
    isConfigured() ? rankedKeywords(domain).catch(() => []) : Promise.resolve([]),
    auditSite(brand, 8).catch(() => ({ audited: 0, issues: [] as { severity: string }[] })),
    checkAiVisibility(brand).catch(() => ({ mentioned: false })),
  ]);

  // Striking distance + avg position: prefer GSC; fall back to DataForSEO rankings.
  let strikingCount = striking.length;
  let avgPos = striking.length ? striking.reduce((s, r) => s + r.position, 0) / striking.length : null;
  if (!strikingCount && ranked.length) {
    strikingCount = ranked.filter((k) => k.position >= 4 && k.position <= 20).length;
    const positions = ranked.map((k) => k.position).filter((p) => p > 0);
    avgPos = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
  }

  // Site health: 100 minus weighted issues found by the auditor.
  const issues = (audit as { issues?: { severity: string }[] }).issues || [];
  const penalty = issues.reduce((sum, i) => sum + (i.severity === "high" ? 15 : i.severity === "medium" ? 7 : 3), 0);
  const siteHealth = (audit as { audited?: number }).audited ? Math.max(0, 100 - penalty) : null;

  // AI visibility: mentioned in an AI answer for the core discovery query => 100.
  const aiVisibility = (aiVis as { mentioned?: boolean }).mentioned ? 100 : 0;

  const snap: Snapshot = {
    organic_traffic: overview?.organic_traffic ?? null,
    organic_keywords: overview?.organic_keywords ?? null,
    backlinks: backlinks?.backlinks ?? null,
    referring_domains: backlinks?.referring_domains ?? null,
    striking_distance: strikingCount || null,
    avg_position: avgPos ? Math.round(avgPos * 10) / 10 : null,
    ai_visibility: aiVisibility,
    site_health: siteHealth,
  };

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
