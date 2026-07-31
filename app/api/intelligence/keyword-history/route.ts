import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { keywordDailyHistory } from "@/lib/gsc";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 60;

// Time series data for a single keyword — feeds the keyword drawer charts.
// Tries stored keyword_positions first; falls back to live GSC API for gaps.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  const keyword = url.searchParams.get("keyword");
  const range = url.searchParams.get("range") || "30";
  if (!brandId || !keyword) {
    return NextResponse.json({ error: "brand and keyword required" }, { status: 400 });
  }
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const days = range === "7" ? 7 : range === "90" ? 90 : range === "180" ? 180 : range === "365" ? 365 : range === "all" ? 1095 : 30;
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

  // 1. Pull stored rows first
  const { data: stored } = await db
    .from("keyword_positions")
    .select("captured_date, position, clicks, impressions, ctr, landing_page")
    .eq("brand_id", brandId)
    .eq("keyword", keyword)
    .gte("captured_date", since)
    .order("captured_date", { ascending: true });

  // 2. Pull any seo_action_events for this keyword to overlay as chart markers
  const { data: kw } = await db
    .from("tracked_keywords")
    .select("id")
    .eq("brand_id", brandId)
    .eq("keyword", keyword)
    .single();

  const { data: events } = kw
    ? await db
        .from("seo_action_events")
        .select("occurred_at, event_type, event_label, page_url")
        .eq("keyword_id", kw.id)
        .gte("occurred_at", since + "T00:00:00Z")
        .order("occurred_at", { ascending: true })
    : { data: [] };

  // 3. If fewer than 3 stored rows and GSC is available, fetch live history
  let history = stored || [];
  if (history.length < 3) {
    const { data: brand } = await db.from("brands").select("gsc_property").eq("id", brandId).single();
    if (brand?.gsc_property) {
      const startDate = since;
      const endDate = new Date().toISOString().slice(0, 10);
      const live = await keywordDailyHistory(brand.gsc_property, keyword, startDate, endDate).catch(() => []);
      if (live.length > history.length) {
        history = live.map((r) => ({ captured_date: r.date, position: r.position, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, landing_page: null }));
      }
    }
  }

  return NextResponse.json({ history, events: events || [] });
}
