import { NextRequest, NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { enqueue } from "@/lib/queue";

export const maxDuration = 60;

// Weekly cron (Monday 7am): enqueue rank_enrich for all active brands.
// Enrichment = DataForSEO difficulty/intent + AI opportunity scoring.
// Runs weekly to control DataForSEO API cost.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const brands = await getActiveBrands();
  for (const b of brands) await enqueue(b.id, "rank_enrich");
  return NextResponse.json({ ok: true, queued: brands.length });
}
