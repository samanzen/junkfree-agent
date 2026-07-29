import { NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { db } from "@/lib/supabase";
import { latestWithDelta, series } from "@/lib/metrics";

export const maxDuration = 60;

export async function GET() {
  const brands = await getActiveBrands();
  const results = [];

  for (const brand of brands) {
    // Count rows in metric_snapshots for this brand
    const { count } = await db.from("metric_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id);

    // Try latestWithDelta
    const { current } = await latestWithDelta(brand.id);

    // Get the raw rows
    const { data: rows } = await db.from("metric_snapshots")
      .select("brand_id, organic_traffic, organic_keywords, captured_at")
      .eq("brand_id", brand.id)
      .order("captured_at", { ascending: false })
      .limit(3);

    results.push({
      brand: brand.name,
      brand_id: brand.id,
      snapshot_count: count,
      latest_from_function: current,
      raw_rows: rows,
    });
  }

  return NextResponse.json(results);
}
