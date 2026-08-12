import { db } from "./supabase";
import type { Brand } from "./brands";
import { strikingDistance } from "./gsc";
import { domainOverview, backlinksSummary, rankedKeywords, isConfigured, geoOf } from "./dataforseo";
import { checkAiVisibilitySuite } from "./geo-agent";
import { canUse, quotaFor } from "./capabilities";
import { persistAiVisibilityChecks } from "./aiVisibility";
import { captureConversionSignals } from "./conversions";

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

// Lightweight snapshot — DataForSEO + GSC + AI visibility share + conversions.
export async function snapshot(brand: Brand): Promise<Snapshot> {
  const domain = domainOf(brand);
  const gsc = brand.gsc_property;

  const geo = geoOf(brand);
  const [striking, overview, backlinks, ranked, healthRows] = await Promise.all([
    gsc ? strikingDistance(gsc).catch(() => []) : Promise.resolve([]),
    isConfigured() ? domainOverview(domain, geo).catch(() => null) : Promise.resolve(null),
    isConfigured() ? backlinksSummary(domain).catch(() => null) : Promise.resolve(null),
    isConfigured()
      ? rankedKeywords(domain, geo, Math.min(100, quotaFor(brand, "tracked_keywords"))).catch(() => [])
      : Promise.resolve([]),
    db
      .from("reports")
      .select("summary")
      .eq("brand_id", brand.id)
      .eq("section", "site_health")
      .order("created_at", { ascending: false })
      .limit(1)
      .then((r) => r.data || []),
  ]);

  let site_health: number | null = null;
  try {
    const parsed = healthRows[0]?.summary ? JSON.parse(healthRows[0].summary) : null;
    site_health = typeof parsed?.score === "number" ? parsed.score : null;
  } catch {
    /* leave null */
  }

  // Multi-prompt AI visibility share (0–100). Persists per-prompt rows when
  // migration 015 is applied; degrades to score-only otherwise.
  let aiVisibility: number | null = null;
  if (canUse(brand, "ai_visibility_tracking")) {
    try {
      const promptCap = Math.min(5, quotaFor(brand, "ai_prompts"));
      const { data: custom } = await db
        .from("ai_visibility_prompts")
        .select("prompt")
        .eq("brand_id", brand.id)
        .eq("active", true)
        .limit(promptCap);
      const customPrompts = (custom || []).map((r: { prompt: string }) => r.prompt);
      const suite = await checkAiVisibilitySuite(
        brand,
        promptCap,
        customPrompts.length ? customPrompts : undefined
      );
      aiVisibility = suite.score;
      await persistAiVisibilityChecks(brand.id, suite.checks).catch(() => undefined);
    } catch {
      aiVisibility = null;
    }
  }

  if (canUse(brand, "conversion_signals")) {
    await captureConversionSignals(brand).catch(() => undefined);
  }

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
    brand_id: brand.id,
    ...snap,
    captured_at: new Date().toISOString(),
  });
  return snap;
}

export async function series(brandId: string, limit = 30) {
  const { data } = await db
    .from("metric_snapshots")
    .select("*")
    .eq("brand_id", brandId)
    .order("captured_at", { ascending: true })
    .limit(limit);
  return data || [];
}

export async function latestWithDelta(brandId: string) {
  const { data } = await db
    .from("metric_snapshots")
    .select("*")
    .eq("brand_id", brandId)
    .order("captured_at", { ascending: false })
    .limit(2);
  return { current: data?.[0] || null, previous: data?.[1] || null };
}
