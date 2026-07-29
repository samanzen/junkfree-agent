import { NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { db } from "@/lib/supabase";
import { latestWithDelta } from "@/lib/metrics";

export const maxDuration = 60;

export async function GET() {
  const brands = await getActiveBrands();
  const results = [];

  for (const brand of brands) {
    const { count } = await db.from("metric_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id);

    const { current } = await latestWithDelta(brand.id);

    const { data: raw } = await db.from("metric_snapshots")
      .select("brand_id, organic_traffic, captured_at")
      .eq("brand_id", brand.id)
      .order("captured_at", { ascending: false })
      .limit(2);

    results.push({
      brand: brand.name,
      brand_id: brand.id,
      count_in_db: count,
      latestWithDelta_current: current,
      raw_rows: raw,
    });
  }

  return NextResponse.json(results);
}
