import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const maxDuration = 30;

// Five intelligence categories derived from position history comparisons.
export async function GET(req: NextRequest) {
  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

  // Current positions
  const { data: current } = await db
    .from("keyword_positions")
    .select("keyword, position, clicks, impressions, landing_page")
    .eq("brand_id", brandId)
    .eq("captured_date", today);

  // Positions 7 days ago
  const { data: previous } = await db
    .from("keyword_positions")
    .select("keyword, position")
    .eq("brand_id", brandId)
    .eq("captured_date", sevenDaysAgo);

  // Tracked keyword metadata (volume, opportunity score)
  const { data: metadata } = await db
    .from("tracked_keywords")
    .select("keyword, search_volume, ai_opportunity_score, ai_opportunity_reason, status")
    .eq("brand_id", brandId);

  const curMap = new Map((current || []).map((r) => [r.keyword, r]));
  const prevMap = new Map((previous || []).map((r) => [r.keyword, r.position as number]));
  const metaMap = new Map((metadata || []).map((m) => [m.keyword, m]));

  const allCurrent = [...curMap.entries()];

  // Biggest gains (position improved = number went down)
  const gains = allCurrent
    .filter(([kw]) => prevMap.has(kw) && curMap.get(kw)!.position < prevMap.get(kw)!)
    .map(([kw, r]) => ({
      keyword: kw, current_position: r.position,
      previous_position: prevMap.get(kw)!,
      change: prevMap.get(kw)! - r.position,
      ...metaMap.get(kw),
    }))
    .filter((r) => r.change >= 1)
    .sort((a, b) => b.change - a.change)
    .slice(0, 10);

  // Biggest drops
  const drops = allCurrent
    .filter(([kw]) => prevMap.has(kw) && curMap.get(kw)!.position > prevMap.get(kw)!)
    .map(([kw, r]) => ({
      keyword: kw, current_position: r.position,
      previous_position: prevMap.get(kw)!,
      change: curMap.get(kw)!.position - prevMap.get(kw)!,
      ...metaMap.get(kw),
    }))
    .filter((r) => r.change >= 1)
    .sort((a, b) => b.change - a.change)
    .slice(0, 10);

  // New keywords (in current but not in previous)
  const newKeywords = allCurrent
    .filter(([kw]) => !prevMap.has(kw))
    .map(([kw, r]) => ({ keyword: kw, position: r.position, ...metaMap.get(kw) }))
    .sort((a, b) => (a.position || 100) - (b.position || 100))
    .slice(0, 10);

  // Lost keywords (in previous but not in current)
  const lostKeywords = [...prevMap.entries()]
    .filter(([kw]) => !curMap.has(kw))
    .map(([kw, pos]) => ({ keyword: kw, last_position: pos, ...metaMap.get(kw) }))
    .slice(0, 10);

  // Almost page 1 (positions 11-20 with any volume)
  const almostPage1 = allCurrent
    .filter(([, r]) => r.position >= 11 && r.position <= 20)
    .map(([kw, r]) => ({ keyword: kw, position: r.position, landing_page: r.landing_page, ...metaMap.get(kw) }))
    .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
    .slice(0, 10);

  return NextResponse.json({ gains, drops, new_keywords: newKeywords, lost_keywords: lostKeywords, almost_page_1: almostPage1 });
}
