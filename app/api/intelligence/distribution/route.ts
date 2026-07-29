import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const maxDuration = 20;

// Position distribution trend over time — feeds the distribution chart.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  const days = Math.min(365, parseInt(url.searchParams.get("days") || "30"));
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });

  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const { data } = await db
    .from("position_distribution_snapshots")
    .select("captured_date, top_3, top_10, top_20, top_50, top_100, not_ranked, new_this_week, lost_this_week, improved_this_week, declined_this_week, total_clicks, total_impressions, avg_ctr")
    .eq("brand_id", brandId)
    .gte("captured_date", since)
    .order("captured_date", { ascending: true });

  return NextResponse.json({ distribution: data || [], days });
}
