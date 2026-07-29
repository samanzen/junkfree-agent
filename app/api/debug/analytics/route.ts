import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const brandId = new URL(req.url).searchParams.get("brand");

  const { data: filtered, error: fe } = await db.from("metric_snapshots")
    .select("brand_id, organic_traffic, captured_at")
    .eq("brand_id", brandId || "")
    .order("captured_at", { ascending: false })
    .limit(3);

  const { data: all, error: ae } = await db.from("metric_snapshots")
    .select("brand_id, organic_traffic, captured_at")
    .order("captured_at", { ascending: false })
    .limit(5);

  const { data: brands } = await db.from("brands").select("id, name, slug");

  return NextResponse.json({
    queried_brand_id: brandId,
    filtered_results: filtered,
    filtered_error: fe?.message,
    all_results: all,
    all_error: ae?.message,
    all_brands: brands,
  });
}
