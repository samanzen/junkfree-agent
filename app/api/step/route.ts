import { NextResponse } from "next/server";
import { claimNext, finishJob, queuedCount } from "@/lib/queue";
import { runJob } from "@/lib/steps";

export const maxDuration = 60;

// Process ONE queued job (small enough to finish under 60s). The dashboard
// calls this repeatedly until { done: true }.
export async function POST() {
  const job = await claimNext();
  if (!job) return NextResponse.json({ done: true });
  try {
    await runJob(job);
  } catch (e) {
    // mark done anyway so one bad job can't block the queue forever
    await finishJob(job.id);
    return NextResponse.json({ done: false, error: String(e), kind: job.kind });
  }
  await finishJob(job.id);
  const remaining = await queuedCount();
  return NextResponse.json({ done: remaining === 0, remaining, kind: job.kind });
}
