import { db } from "./supabase";
import type { Brand } from "./brands";
import { strikingDistance } from "./gsc";
import { domainOverview, backlinksSummary, rankedKeywords, isConfigured, geoOf } from "./dataforseo";
import { checkAiVisibility } from "./geo-agent";

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

export function domainOf(brand: Brand) {
  return brand.site_url.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "");
}

// Lightweight snapshot — only DataForSEO + GSC (fast, under 30s).
export async function snapshot(brand: Brand): Promise<Snapshot> {
  const domain = domainOf(brand);
  const gsc = brand.gsc_property;

  const geo = geoOf(brand);
  const [striking, overview, backlinks, ranked, healthRows] = await Promise.all([
    gsc ? strikingDistance(gsc).catch(() => []) : Promise.resolve([]),
    isConfigured() ? domainOverview(domain, geo).catch(() => null) : Promise.resolve(null),
    isConfigured() ? backlinksSummary(domain).catch(() => null) : Promise.resolve(null),
    isConfigured() ? rankedKeywords(domain, geo).catch(() => []) : Promise.resolve([]),
    // Site Health is computed by the daily audit job (lib/steps.ts stepAudit),
    // not here — this is a single fast DB read, not a re-crawl, so it stays
    // within the "lightweight snapshot" budget this function is named for.
    db.from("reports").select("summary").eq("brand_id", brand.id).eq("section", "site_health")
      .order("created_at", { ascending: false }).limit(1).then((r) => r.data || []),
  ]);

  let site_health: number | null = null;
  try {
    const parsed = healthRows[0]?.summary ? JSON.parse(healthRows[0].summary) : null;
    site_health = typeof parsed?.score === "number" ? parsed.score : null;
  } catch { /* leave null */ }

  // checkAiVisibility (lib/geo-agent.ts) has existed since Sprint 5 with zero
  // callers, which is why ai_visibility has been null in every snapshot ever
  // taken and why the portal's AI Visibility card reads "Coming soon".
  //
  // It asks a model, with web search, the discovery question a customer would
  // ask ("best <service> in <city>") and reports whether this brand appears in
  // the answer. That is a genuine yes/no, so it is stored as 100 or 0 rather
  // than dressed up as a percentage — the card's wording says exactly what the
  // number means.
  //
  // Best-effort: a failure leaves the column null, which is what every previous
  // snapshot already contained, so nothing downstream changes.
  const aiVisibility = await checkAiVisibility(brand)
    .then((r) => (r.mentioned ? 100 : 0))
    .catch(() => null);

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
    ai_visibility: aiVisibility,
    site_health,
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
