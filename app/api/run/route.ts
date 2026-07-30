import { NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { enqueue, clearStale } from "@/lib/queue";

export const maxDuration = 60;

// Kick off a run: clear stale jobs, then enqueue a "plan" job per active brand,
// plus a "rank_sync" for every brand with GSC configured.
//
// rank_sync is what populates tracked_keywords / keyword_positions /
// position_distribution_snapshots — i.e. every Intelligence panel (Keywords,
// Winners & Losers, Distribution, Overview). It used to be enqueued *only* by
// the /api/cron/rank-sync endpoint, so clicking "Run agents now" could never
// fill those panels no matter how many times it was pressed, even though the
// empty states told the user to do exactly that.
//
// Processing happens via repeated /api/step calls (driven by the dashboard).
export async function POST() {
  await clearStale();
  const brands = await getActiveBrands();
  if (!brands.length) return NextResponse.json({ error: "No active brands. Seed the brands table." }, { status: 400 });
  let rankSyncs = 0;
  for (const b of brands) {
    await enqueue(b.id, "plan");
    if (b.gsc_property) { await enqueue(b.id, "rank_sync"); rankSyncs++; }
  }
  return NextResponse.json({ ok: true, queued: brands.length, rank_syncs: rankSyncs });
}
