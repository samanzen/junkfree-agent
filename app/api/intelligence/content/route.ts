import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 30;

// Content performance: page-level aggregation from keyword_positions.
// Shows which pages are growing, stable, or declining.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  // Use the most recent date this brand actually HAS, not today's date.
  //
  // This previously required captured_date to equal today. The sync that
  // writes those rows runs at 06:00 UTC, so the page reported "No page data
  // yet" every day between midnight UTC and the sync completing — about six
  // and a half hours daily, with thousands of rows sitting in the table. It
  // also meant any late or failed sync blanked the page instead of showing
  // the previous day's numbers.
  const { data: latestRow } = await db
    .from("keyword_positions")
    .select("captured_date")
    .eq("brand_id", brandId)
    .not("landing_page", "is", null)
    .order("captured_date", { ascending: false })
    .limit(1);

  const latestDate = (latestRow as { captured_date: string }[] | null)?.[0]?.captured_date || null;
  if (!latestDate) {
    // Genuinely nothing collected yet — distinct from "today's sync is late".
    return NextResponse.json({ pages: [], total: 0, data_date: null, comparison_date: null });
  }

  // Compare against the most recent date at least 7 days older than the
  // current one. Anchoring to "7 days before TODAY" would silently compare
  // against nothing whenever the data itself is a day or two behind.
  const cutoff = new Date(Date.parse(latestDate) - 7 * 864e5).toISOString().slice(0, 10);
  const { data: priorRow } = await db
    .from("keyword_positions")
    .select("captured_date")
    .eq("brand_id", brandId)
    .not("landing_page", "is", null)
    .lte("captured_date", cutoff)
    .order("captured_date", { ascending: false })
    .limit(1);
  const comparisonDate = (priorRow as { captured_date: string }[] | null)?.[0]?.captured_date || null;

  // Aggregate current positions by landing_page
  const { data: current } = await db
    .from("keyword_positions")
    .select("landing_page, keyword, position, clicks, impressions, ctr")
    .eq("brand_id", brandId)
    .eq("captured_date", latestDate)
    .not("landing_page", "is", null);

  const { data: previous } = comparisonDate
    ? await db
        .from("keyword_positions")
        .select("landing_page, position, clicks, impressions")
        .eq("brand_id", brandId)
        .eq("captured_date", comparisonDate)
        .not("landing_page", "is", null)
    : { data: [] };

  // Aggregate by page
  const pageMap = new Map<string, {
    clicks: number; impressions: number; ctr_sum: number; count: number;
    best_position: number; keywords: string[];
  }>();
  for (const r of current || []) {
    const p = r.landing_page as string;
    if (!pageMap.has(p)) pageMap.set(p, { clicks: 0, impressions: 0, ctr_sum: 0, count: 0, best_position: 999, keywords: [] });
    const e = pageMap.get(p)!;
    e.clicks += r.clicks || 0;
    e.impressions += r.impressions || 0;
    e.ctr_sum += r.ctr || 0;
    e.count++;
    if ((r.position || 999) < e.best_position) e.best_position = r.position;
    if (r.keyword) e.keywords.push(r.keyword);
  }

  const prevPageMap = new Map<string, { clicks: number; impressions: number }>();
  for (const r of previous || []) {
    const p = r.landing_page as string;
    if (!prevPageMap.has(p)) prevPageMap.set(p, { clicks: 0, impressions: 0 });
    const e = prevPageMap.get(p)!;
    e.clicks += r.clicks || 0;
    e.impressions += r.impressions || 0;
  }

  const pages = [...pageMap.entries()].map(([page, d]) => {
    const prev = prevPageMap.get(page);
    const clickDelta = prev ? d.clicks - prev.clicks : null;
    // "new" means the page was absent from a baseline that EXISTS. With no
    // baseline at all — fewer than 7 days of history — nothing can be said
    // about a trend, and labelling every page "new" would state something
    // untrue about all of them.
    const status = !comparisonDate ? "unknown"
      : clickDelta == null ? "new"
      : clickDelta > 5 ? "growing"
      : clickDelta < -5 ? "declining"
      : "stable";
    return {
      page,
      clicks: d.clicks,
      impressions: d.impressions,
      avg_ctr: d.count ? d.ctr_sum / d.count : 0,
      best_position: d.best_position === 999 ? null : d.best_position,
      keyword_count: d.count,
      top_keyword: d.keywords[0] || null,
      click_delta: clickDelta,
      status,
    };
  }).sort((a, b) => b.clicks - a.clicks);

  return NextResponse.json({
    pages,
    total: pages.length,
    // Surfaced so the page can say how fresh the numbers are. Without this a
    // stale sync looks identical to a healthy one.
    data_date: latestDate,
    comparison_date: comparisonDate,
  });
}
