import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";
import {
  backlinksSummary,
  domainOverview,
  geoOf,
  rankedKeywords,
} from "@/lib/dataforseo";

export const maxDuration = 120;

type CompRow = {
  id: string;
  domain: string;
  name: string | null;
  last_keyword_count: number | null;
  last_organic_traffic: number | null;
  last_backlinks: number | null;
  last_common_keywords: number | null;
  last_keyword_gap: number | null;
  last_checked_at: string | null;
};

/**
 * Competitor Tracking report (Ubersuggest-style).
 * GET  — cached table + your traffic history for the chart
 * POST — refresh metrics for all active competitors (DataForSEO)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const { data: brand } = await db
    .from("brands")
    .select("id, name, site_url, dataforseo_location_code, dataforseo_language_code")
    .eq("id", brandId)
    .single();
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const fullSelect =
    "id, domain, name, last_keyword_count, last_organic_traffic, last_backlinks, last_common_keywords, last_keyword_gap, last_checked_at";
  const basicSelect = "id, domain, name, last_keyword_count, last_checked_at";

  const fullRes = await db
    .from("competitors")
    .select(fullSelect)
    .eq("brand_id", brandId)
    .eq("active", true)
    .order("added_at", { ascending: true });

  // Migration 018 may not be applied yet — fall back to older columns.
  let rawCompetitors: Array<Record<string, unknown>> = [];
  if (fullRes.error) {
    const basicRes = await db
      .from("competitors")
      .select(basicSelect)
      .eq("brand_id", brandId)
      .eq("active", true)
      .order("added_at", { ascending: true });
    rawCompetitors = (basicRes.data || []) as Array<Record<string, unknown>>;
  } else {
    rawCompetitors = (fullRes.data || []) as Array<Record<string, unknown>>;
  }

  const [{ data: snaps }, { count: brandKwCount }] = await Promise.all([
    db
      .from("metric_snapshots")
      .select("organic_traffic, organic_keywords, backlinks, captured_at")
      .eq("brand_id", brandId)
      .order("captured_at", { ascending: true })
      .limit(24),
    db
      .from("tracked_keywords")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .neq("status", "lost"),
  ]);

  const competitors: CompRow[] = rawCompetitors.map((c) => ({
    id: String(c.id),
    domain: String(c.domain),
    name: (c.name as string | null) ?? null,
    last_keyword_count: (c.last_keyword_count as number | null) ?? null,
    last_organic_traffic: (c.last_organic_traffic as number | null) ?? null,
    last_backlinks: (c.last_backlinks as number | null) ?? null,
    last_common_keywords: (c.last_common_keywords as number | null) ?? null,
    last_keyword_gap: (c.last_keyword_gap as number | null) ?? null,
    last_checked_at: (c.last_checked_at as string | null) ?? null,
  }));

  const youDomain = (() => {
    try {
      return new URL(brand.site_url).hostname.replace(/^www\./, "");
    } catch {
      return brand.site_url || brand.name;
    }
  })();

  const latestYou = snaps?.[snaps.length - 1] || null;

  return NextResponse.json({
    you: {
      domain: youDomain,
      name: brand.name,
      organic_traffic: latestYou?.organic_traffic ?? null,
      organic_keywords: latestYou?.organic_keywords ?? brandKwCount ?? null,
      backlinks: latestYou?.backlinks ?? null,
      history: (snaps || []).map((s) => ({
        date: s.captured_at,
        organic_traffic: s.organic_traffic ?? 0,
      })),
    },
    competitors,
    brand_keyword_count: brandKwCount || 0,
  });
}

/** Refresh all competitor snapshots from DataForSEO. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brand_id } = await req.json().catch(() => ({}));
  if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  const limited = await enforceRate(brand_id, "external");
  if (limited) return limited;

  const { data: brand } = await db
    .from("brands")
    .select("id, site_url, dataforseo_location_code, dataforseo_language_code")
    .eq("id", brand_id)
    .single();
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const geo = geoOf(brand);

  const { data: brandKws } = await db
    .from("tracked_keywords")
    .select("keyword")
    .eq("brand_id", brand_id)
    .neq("status", "lost");
  const brandKwSet = new Set((brandKws || []).map((k) => k.keyword.toLowerCase()));

  const { data: competitors } = await db
    .from("competitors")
    .select("id, domain")
    .eq("brand_id", brand_id)
    .eq("active", true);

  const updated: string[] = [];
  for (const c of competitors || []) {
    const [overview, backlinks, ranked] = await Promise.all([
      domainOverview(c.domain, geo).catch(() => null),
      backlinksSummary(c.domain).catch(() => null),
      rankedKeywords(c.domain, geo).catch(() => []),
    ]);

    const rankedList = ranked || [];
    const common = rankedList.filter((k) => brandKwSet.has((k.keyword || "").toLowerCase())).length;
    const gap = rankedList.filter(
      (k) => k.keyword && !brandKwSet.has(k.keyword.toLowerCase()) && k.position <= 20
    ).length;

    await db
      .from("competitors")
      .update({
        last_keyword_count: rankedList.length || overview?.organic_keywords || null,
        last_organic_traffic: overview?.organic_traffic ?? null,
        last_backlinks: backlinks?.backlinks ?? null,
        last_common_keywords: common,
        last_keyword_gap: gap,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", c.id);
    updated.push(c.id);
  }

  // Also refresh "you" into metric_snapshots if we can resolve domain overview
  try {
    const host = new URL(brand.site_url).hostname.replace(/^www\./, "");
    const youOverview = await domainOverview(host, geo).catch(() => null);
    const youBacklinks = await backlinksSummary(host).catch(() => null);
    if (youOverview || youBacklinks) {
      await db.from("metric_snapshots").insert({
        brand_id,
        organic_traffic: youOverview?.organic_traffic ?? null,
        organic_keywords: youOverview?.organic_keywords ?? brandKwSet.size,
        backlinks: youBacklinks?.backlinks ?? null,
        referring_domains: youBacklinks?.referring_domains ?? null,
        captured_at: new Date().toISOString(),
      });
    }
  } catch {
    /* site_url parse / insert optional */
  }

  return NextResponse.json({ ok: true, refreshed: updated.length });
}
