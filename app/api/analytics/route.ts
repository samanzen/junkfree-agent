import { NextRequest, NextResponse } from "next/server";
import { series, latestWithDelta } from "@/lib/metrics";
import { db } from "@/lib/supabase";
import { strikingDistance } from "@/lib/gsc";

// Feeds the Overview: latest KPIs + deltas + time series + top keywords per brand.
export async function GET(req: NextRequest) {
  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });

  const { data: brand } = await db.from("brands").select("*").eq("id", brandId).single();

  const [{ current, previous }, ts, keywords] = await Promise.all([
    latestWithDelta(brandId),
    series(brandId, 30),
    brand?.gsc_property ? strikingDistance(brand.gsc_property).catch(() => []) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    current, previous, series: ts,
    keywords: (keywords || []).slice(0, 10),
  });
}
