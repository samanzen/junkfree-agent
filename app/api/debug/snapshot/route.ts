import { NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { db } from "@/lib/supabase";

export const maxDuration = 60;

// Force-inserts a test snapshot for every brand and checks if latestWithDelta finds it.
export async function GET() {
  const brands = await getActiveBrands();
  const results = [];

  for (const brand of brands) {
    // 1. Count existing rows
    const { count: existing } = await db.from("metric_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id);

    // 2. Force-insert a test snapshot with real-looking data
    const { error: insertErr } = await db.from("metric_snapshots").insert({
      brand_id: brand.id,
      organic_traffic: 91,
      organic_keywords: 85,
      backlinks: 644,
      referring_domains: 56,
      striking_distance: 12,
      avg_position: 18.4,
      ai_visibility: 0,
      site_health: null,
      captured_at: new Date().toISOString(),
    });

    // 3. Read it back
    const { data: readback, error: readErr } = await db.from("metric_snapshots")
      .select("*")
      .eq("brand_id", brand.id)
      .order("captured_at", { ascending: false })
      .limit(1)
      .single();

    results.push({
      brand: brand.name,
      brand_id: brand.id,
      rows_before: existing,
      insert_error: insertErr?.message ?? null,
      readback_traffic: readback?.organic_traffic ?? null,
      readback_error: readErr?.message ?? null,
    });
  }

  return NextResponse.json(results);
}
