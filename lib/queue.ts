// JOB QUEUE — lets the full agent brain run on Vercel's free tier (60s/function)
// by breaking a run into small jobs, each processed in its own quick call.
// Same end result as one long run, just split into steps.

import { db } from "./supabase";

export type JobKind =
  | "plan"        // intelligence + planning -> enqueues content/geo/gbp/etc jobs
  | "content"     // write one content draft (+ queue its images)
  | "geo"         // GEO answer content
  | "gbp"         // Google Business post
  | "citations"   // backlink opportunities
  | "performance"; // learning loop

export async function enqueue(brandId: string, kind: JobKind, payload: Record<string, unknown> = {}) {
  await db.from("jobs").insert({ brand_id: brandId, kind, payload, status: "queued" });
}

// Grab the oldest queued job and mark it running (simple single-worker model).
export async function claimNext() {
  const { data } = await db
    .from("jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);
  const job = data?.[0];
  if (!job) return null;
  await db.from("jobs").update({ status: "running" }).eq("id", job.id);
  return job as { id: string; brand_id: string; kind: JobKind; payload: Record<string, unknown> };
}

export async function finishJob(id: string) {
  await db.from("jobs").update({ status: "done" }).eq("id", id);
}

export async function queuedCount(): Promise<number> {
  const { count } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "running"]);
  return count || 0;
}

// Clear stale jobs (older than 1h) so a stuck run never blocks forever.
export async function clearStale() {
  const cutoff = new Date(Date.now() - 3600_000).toISOString();
  await db.from("jobs").update({ status: "done" }).lt("created_at", cutoff).neq("status", "done");
}
