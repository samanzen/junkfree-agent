import { NextRequest, NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { enqueue, clearStale } from "@/lib/queue";

export const maxDuration = 60;

// Daily cron: enqueue rank_sync job for every active brand with GSC configured.
// Runs at 6am daily (before the 9am agent run) so position data is fresh
// when the agent plans its work.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await clearStale();
  const brands = await getActiveBrands();
  const eligible = brands.filter((b) => !!b.gsc_property);
  for (const b of eligible) await enqueue(b.id, "rank_sync");
  return NextResponse.json({ ok: true, queued: eligible.length });
}
