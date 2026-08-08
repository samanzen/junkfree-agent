// EXECUTION ENGINE (Sprint 5.2) — the single place that seeds a brand's job
// queue and processes it. Every entry point here operates on ONE brand at a
// time and is protected by a brand-level lock around the seed decision, so a
// brand is never seeded twice by an overlapping click/cron tick.
//
// Used by:
//  - app/api/run   (human "Run agents now" trigger, one brand per request)
//  - app/api/step  (human-driven drain, one job per request — via processOneJob)
//  - app/api/cron/*  (unattended: seeds AND drains each brand independently,
//    since there's no browser to keep calling /api/step for it)

import { db } from "./supabase";
import type { Brand } from "./brands";
import {
  enqueue,
  claimNext,
  clearStale,
  finishJob,
  queuedCount,
  pendingCount,
  acquireBrandLock,
  releaseBrandLock,
  type JobKind,
} from "./queue";
import { runJob } from "./steps";

// Long enough to cover the check-then-enqueue critical section with room to
// spare; short enough that a crashed seed attempt self-heals almost
// immediately (acquireBrandLock steals expired locks automatically).
const SEED_LOCK_TTL_SECONDS = 120;

export type SeedResult =
  | { status: "locked" }
  | { status: "queued"; queued: number };

// Seed `kinds` for a brand, guarded by an idle check.
//
// checkAllPending: when true, the idle check looks at EVERY job kind
// currently queued/running for the brand, not just the given kinds --
// required for the full plan pipeline (triggerBrandRun), because plan fans
// out into content/geo/gbp/citations/audit/performance jobs that can still
// be draining long after the plan job itself has finished. Checking only
// the seed kinds there would let a second trigger seed a brand-new pipeline
// on top of a still-draining one. Standalone single-kind seeds (rank_sync,
// rank_enrich) do not have this problem -- they never fan out into other
// kinds -- so they keep the narrower, kind-scoped check.
async function seedIfIdle(
  brand: Brand,
  kinds: JobKind[],
  opts: { checkAllPending?: boolean } = {}
): Promise<SeedResult> {
  const gotLock = await acquireBrandLock(brand.id, SEED_LOCK_TTL_SECONDS);
  if (!gotLock) return { status: "locked" };

  try {
    const pending = opts.checkAllPending
      ? await queuedCount(brand.id)
      : await pendingCount(brand.id, kinds);
    if (pending > 0) return { status: "queued", queued: pending }; // resume existing backlog instead of re-seeding

    for (const kind of kinds) await enqueue(brand.id, kind);
    return { status: "queued", queued: kinds.length };
  } finally {
    await releaseBrandLock(brand.id);
  }
}

// Daily content pipeline: plan (+ rank_sync when GSC is configured). Blocked
// while ANY job is still queued/running for this brand -- the plan job's own
// children (content/geo/gbp/citations/audit/performance) count too, so a
// still-draining pipeline can never be duplicated by a second trigger.
export async function triggerBrandRun(brand: Brand): Promise<SeedResult> {
  const kinds: JobKind[] = ["plan"];
  if (brand.gsc_property) kinds.push("rank_sync");
  return seedIfIdle(brand, kinds, { checkAllPending: true });
}

// Daily rank-tracking sync (own cron, separate cadence from the plan pipeline).
export async function triggerRankSync(brand: Brand): Promise<SeedResult> {
  return seedIfIdle(brand, ["rank_sync"]);
}

// Weekly DataForSEO enrichment (own cron, separate cadence).
export async function triggerRankEnrich(brand: Brand): Promise<SeedResult> {
  return seedIfIdle(brand, ["rank_enrich"]);
}

export type StepResult = { done: boolean; kind?: JobKind; remaining?: number; error?: string };

// Process exactly ONE queued job for a brand. Same response shape the old
// global /api/step returned ({done, kind, remaining, error}) so the
// dashboard's existing polling loop keeps working unchanged. Finalizes the
// open run for this brand whenever the queue turns out to be empty
// afterward -- including when there was no job to claim, and when the job
// that was claimed failed -- so a run can never get stuck at "running" just
// because its last job errored.
export async function processOneJob(brandId: string): Promise<StepResult> {
  // Reclaim this brand's orphaned jobs BEFORE claiming a new one.
  //
  // A serverless invocation that is killed mid-job never reaches finishJob(),
  // so its row is stranded at "running" with no process behind it. Reclamation
  // used to happen only at the start of a cron tick, and the crons run daily —
  // so a job orphaned three minutes into a tick stayed stuck until the next
  // one. Measured: pomobuild's content job sat "running" for 16+ hours with a
  // 21-hour gap before the next sweep could have touched it.
  //
  // Sweeping here means any drain attempt recovers it, so the window shrinks
  // from a day to however often work is processed. Scoped to this brand, so a
  // customer's request never touches another tenant's rows.
  await clearStale(brandId);

  const job = await claimNext(brandId);
  if (!job) {
    const remaining = await queuedCount(brandId);
    if (remaining === 0) await finalizeOpenRuns(brandId);
    return { done: remaining === 0, remaining };
  }

  let jobError: string | undefined;
  try {
    await runJob(job);
    await finishJob(job.id);
  } catch (e) {
    jobError = String(e);
    await finishJob(job.id, jobError);
  }

  await touchRunProgress(brandId, job.kind);

  const remaining = await queuedCount(brandId);
  if (remaining === 0) await finalizeOpenRuns(brandId);
  return { done: remaining === 0, remaining, kind: job.kind, error: jobError };
}

// Drain a brand's queue in a loop, bounded by a time budget — used by the
// unattended cron path, which has no browser to keep calling /api/step.
export async function drainBrand(brand: Brand, budgetMs: number): Promise<{ processed: number; done: boolean; remaining: number }> {
  const start = Date.now();
  let processed = 0;
  let last: StepResult = { done: true };

  while (Date.now() - start < budgetMs) {
    last = await processOneJob(brand.id);
    processed++;
    if (last.done) break;
  }

  return { processed, done: last.done, remaining: last.remaining ?? 0 };
}

// Best-effort "what's this brand doing right now" marker on its open run.
async function touchRunProgress(brandId: string, step: JobKind) {
  await db.from("runs").update({ last_step: step }).eq("brand_id", brandId).eq("status", "running");
}

// Finalize any run row still marked "running" for a brand once its queue is
// empty — fixes a real gap in the prior job-queue system, where a run row
// was created by stepPlan but nothing ever marked it done/error, so it sat
// at status='running' forever (breaking the dashboard's success-rate stats).
async function finalizeOpenRuns(brandId: string) {
  const { data: openRuns } = await db
    .from("runs")
    .select("id, created_at")
    .eq("brand_id", brandId)
    .eq("status", "running");

  for (const run of openRuns || []) {
    const durationMs = Date.now() - new Date(run.created_at as string).getTime();

    // Conservative failure check: if we cannot determine whether any jobs in
    // this run failed (query error OR a thrown/network-level exception), do
    // NOT default to reporting the run as a clean success -- mark it "error"
    // with a note explaining why, instead of silently defaulting to "done"
    // on an unverified result.
    let failed = 0;
    let failureCheckFailed = false;
    try {
      const failedRes = await db
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brandId)
        .eq("status", "failed")
        .filter("payload->>runId", "eq", run.id);
      if (failedRes.error) {
        failureCheckFailed = true;
      } else {
        failed = failedRes.count || 0;
      }
    } catch {
      failureCheckFailed = true;
    }

    const { count: draftsProduced } = await db
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("run_id", run.id);

    const status = failed > 0 || failureCheckFailed ? "error" : "done";
    const errorNote = failureCheckFailed
      ? "Could not verify job failure status during finalization."
      : null;

    const { error } = await db
      .from("runs")
      .update({
        status,
        error: errorNote,
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        drafts_produced: draftsProduced || 0,
      })
      .eq("id", run.id);

    if (error) {
      // finished_at/duration_ms columns may not exist yet (pre-migration).
      await db.from("runs").update({ status, error: errorNote, drafts_produced: draftsProduced || 0 }).eq("id", run.id);
    }
  }
}
