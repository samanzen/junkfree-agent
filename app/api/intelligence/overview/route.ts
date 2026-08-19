import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { lookbackDateISO, parseReportDays } from "@/lib/intelligence/reportRange";

export const maxDuration = 30;

/**
 * Reports → Overview metrics.
 * `days` picks the comparison window: latest snapshot vs the snapshot
 * closest to (latest − days). Defaults to 30.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const days = parseReportDays(url.searchParams.get("days"), 30);
  const since = lookbackDateISO(days);

  const { data: snapshots } = await db
    .from("position_distribution_snapshots")
    .select("*")
    .eq("brand_id", brandId)
    .gte("captured_date", since)
    .order("captured_date", { ascending: false });

  const list = snapshots || [];
  const cur = list[0] || null;
  // Prefer oldest in the selected window as “where we were”; fall back to
  // the previous snapshot if the window only has one row.
  let prev = list.length > 1 ? list[list.length - 1] : null;
  if (cur && prev && prev.captured_date === cur.captured_date) prev = null;
  if (!prev && list.length === 1) {
    const { data: older } = await db
      .from("position_distribution_snapshots")
      .select("*")
      .eq("brand_id", brandId)
      .lt("captured_date", cur.captured_date)
      .order("captured_date", { ascending: false })
      .limit(1);
    prev = older?.[0] || null;
  }

  const delta = (k: string) => {
    if (!cur || !prev) return null;
    const c = (cur as Record<string, unknown>)[k];
    const p = (prev as Record<string, unknown>)[k];
    if (c == null || p == null) return null;
    return (c as number) - (p as number);
  };

  const { data: statusCounts } = await db
    .from("tracked_keywords")
    .select("status")
    .eq("brand_id", brandId);

  const byStatus = (statusCounts || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const { data: metricSnap } = await db
    .from("metric_snapshots")
    .select("avg_position, organic_keywords")
    .eq("brand_id", brandId)
    .order("captured_at", { ascending: false })
    .limit(1);

  const { data: brandRow } = await db
    .from("brands").select("gsc_property").eq("id", brandId).single();
  const { count: syncCount } = await db
    .from("keyword_positions")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId);

  const status = !brandRow?.gsc_property
    ? "no_gsc"
    : cur
    ? "ok"
    : (syncCount || 0) > 0
    ? "syncing"
    : "never_synced";

  return NextResponse.json({
    top_3: cur?.top_3 ?? null,
    top_10: cur?.top_10 ?? null,
    top_20: cur?.top_20 ?? null,
    top_50: cur?.top_50 ?? null,
    top_100: cur?.top_100 ?? null,
    not_ranked: cur?.not_ranked ?? null,
    total_clicks: cur?.total_clicks ?? null,
    total_impressions: cur?.total_impressions ?? null,
    avg_ctr: cur?.avg_ctr ?? null,
    avg_position: metricSnap?.[0]?.avg_position ?? null,
    total_keywords: metricSnap?.[0]?.organic_keywords ?? (statusCounts?.length ?? null),

    // Previous period values for “where we were”
    previous: prev
      ? {
          top_3: prev.top_3 ?? null,
          top_10: prev.top_10 ?? null,
          top_20: prev.top_20 ?? null,
          total_clicks: prev.total_clicks ?? null,
          total_impressions: prev.total_impressions ?? null,
          avg_ctr: prev.avg_ctr ?? null,
          captured_date: prev.captured_date,
        }
      : null,

    deltas: {
      top_3: delta("top_3"),
      top_10: delta("top_10"),
      top_20: delta("top_20"),
      total_clicks: delta("total_clicks"),
      total_impressions: delta("total_impressions"),
      new_this_week: cur?.new_this_week ?? 0,
      lost_this_week: cur?.lost_this_week ?? 0,
      improved_this_week: cur?.improved_this_week ?? 0,
      declined_this_week: cur?.declined_this_week ?? 0,
    },

    by_status: byStatus,
    compared: {
      current_date: cur?.captured_date ?? null,
      previous_date: prev?.captured_date ?? null,
      days,
    },
    has_data: !!cur,
    status,
  });
}
