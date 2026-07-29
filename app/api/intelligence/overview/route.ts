import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const maxDuration = 30;

// Summary metrics for the Intelligence Center overview panel.
// Reads from pre-computed tables — no expensive aggregations on read.
export async function GET(req: NextRequest) {
  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });

  // Latest two distribution snapshots (current + previous for deltas)
  const { data: snapshots } = await db
    .from("position_distribution_snapshots")
    .select("*")
    .eq("brand_id", brandId)
    .order("captured_date", { ascending: false })
    .limit(2);

  const cur = snapshots?.[0] || null;
  const prev = snapshots?.[1] || null;

  const delta = (k: string) => {
    if (!cur || !prev) return null;
    const c = (cur as Record<string, unknown>)[k];
    const p = (prev as Record<string, unknown>)[k];
    if (c == null || p == null) return null;
    return (c as number) - (p as number);
  };

  // Keyword counts by status
  const { data: statusCounts } = await db
    .from("tracked_keywords")
    .select("status")
    .eq("brand_id", brandId);

  const byStatus = (statusCounts || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  // Latest metric snapshot for avg_position (already stored there)
  const { data: metricSnap } = await db
    .from("metric_snapshots")
    .select("avg_position, organic_keywords")
    .eq("brand_id", brandId)
    .order("captured_at", { ascending: false })
    .limit(1);

  return NextResponse.json({
    // Position distribution
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

    // Week-over-week deltas
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

    // Keyword status breakdown
    by_status: byStatus,

    has_data: !!cur,
  });
}
