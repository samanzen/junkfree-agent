import { NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { enqueue, clearStale } from "@/lib/queue";

export const maxDuration = 60;

// Kick off a run: clear stale jobs, then enqueue a "plan" job per active brand.
// Processing happens via repeated /api/step calls (driven by the dashboard).
export async function POST() {
  await clearStale();
  const brands = await getActiveBrands();
  if (!brands.length) return NextResponse.json({ error: "No active brands. Seed the brands table." }, { status: 400 });
  for (const b of brands) await enqueue(b.id, "plan");
  return NextResponse.json({ ok: true, queued: brands.length });
}
