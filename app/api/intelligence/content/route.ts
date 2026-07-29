import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const maxDuration = 30;

// Content performance: page-level aggregation from keyword_positions.
// Shows which pages are growing, stable, or declining.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

  // Aggregate current positions by landing_page
  const { data: current } = await db
    .from("keyword_positions")
    .select("landing_page, keyword, position, clicks, impressions, ctr")
    .eq("brand_id", brandId)
    .eq("captured_date", today)
    .not("landing_page", "is", null);

  const { data: previous } = await db
    .from("keyword_positions")
    .select("landing_page, position, clicks, impressions")
    .eq("brand_id", brandId)
    .eq("captured_date", sevenDaysAgo)
    .not("landing_page", "is", null);

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
    const status = clickDelta == null ? "new"
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

  return NextResponse.json({ pages, total: pages.length });
}
