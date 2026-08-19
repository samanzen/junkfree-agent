import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { buildPeriodMovementMaps, type NamedPosRow } from "@/lib/intelligence/movement";
import { lookbackDateISO, parseReportDays } from "@/lib/intelligence/reportRange";

export const maxDuration = 30;

/** Reports → What changed (ex Winners & Losers). Supports `days` period compare. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const days = parseReportDays(url.searchParams.get("days"), 30);
  const lookback = lookbackDateISO(days);

  const { data: history } = await db
    .from("keyword_positions")
    .select("keyword, position, clicks, impressions, landing_page, captured_date")
    .eq("brand_id", brandId)
    .gte("captured_date", lookback)
    .order("captured_date", { ascending: false });

  const { currentDate, previousDate, curMap, prevMap } = buildPeriodMovementMaps(
    (history || []) as NamedPosRow[]
  );

  const { data: metadata } = await db
    .from("tracked_keywords")
    .select("keyword, search_volume, ai_opportunity_score, ai_opportunity_reason, status")
    .eq("brand_id", brandId);

  const metaMap = new Map((metadata || []).map((m) => [m.keyword, m]));
  const allCurrent = [...curMap.entries()];

  const gains = allCurrent
    .filter(([kw]) => prevMap.has(kw) && curMap.get(kw)!.position < prevMap.get(kw)!)
    .map(([kw, r]) => ({
      keyword: kw, current_position: r.position,
      previous_position: prevMap.get(kw)!,
      change: Math.round(prevMap.get(kw)! - r.position),
      ...metaMap.get(kw),
    }))
    .filter((r) => r.change >= 1)
    .sort((a, b) => b.change - a.change)
    .slice(0, 15);

  const drops = allCurrent
    .filter(([kw]) => prevMap.has(kw) && curMap.get(kw)!.position > prevMap.get(kw)!)
    .map(([kw, r]) => ({
      keyword: kw, current_position: r.position,
      previous_position: prevMap.get(kw)!,
      change: Math.round(curMap.get(kw)!.position - prevMap.get(kw)!),
      ...metaMap.get(kw),
    }))
    .filter((r) => r.change >= 1)
    .sort((a, b) => b.change - a.change)
    .slice(0, 15);

  const newKeywords = allCurrent
    .filter(([kw]) => !prevMap.has(kw))
    .map(([kw, r]) => ({ keyword: kw, position: r.position, ...metaMap.get(kw) }))
    .sort((a, b) => (a.position || 100) - (b.position || 100))
    .slice(0, 15);

  const lostKeywords = [...prevMap.entries()]
    .filter(([kw]) => !curMap.has(kw))
    .map(([kw, pos]) => ({ keyword: kw, last_position: pos, ...metaMap.get(kw) }))
    .slice(0, 15);

  const almostPage1 = allCurrent
    .filter(([, r]) => r.position >= 11 && r.position <= 20)
    .map(([kw, r]) => ({ keyword: kw, position: r.position, landing_page: r.landing_page, ...metaMap.get(kw) }))
    .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
    .slice(0, 15);

  return NextResponse.json({
    gains,
    drops,
    new_keywords: newKeywords,
    lost_keywords: lostKeywords,
    almost_page_1: almostPage1,
    compared: { current_date: currentDate, previous_date: previousDate, days },
  });
}
