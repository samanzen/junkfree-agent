import { NextRequest, NextResponse } from "next/server";
import { series, latestWithDelta } from "@/lib/metrics";

// Feeds the Overview dashboard: latest KPIs + deltas + time series per brand.
export async function GET(req: NextRequest) {
  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const [{ current, previous }, ts] = await Promise.all([
    latestWithDelta(brandId),
    series(brandId, 30),
  ]);
  return NextResponse.json({ current, previous, series: ts });
}
