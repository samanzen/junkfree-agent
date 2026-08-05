// JOB QUEUE -- lets the full agent brain run on Vercel's free tier (60s/function)
// by breaking a run into small jobs, each processed in its own quick call.
// Same end result as one long run, just split into steps.
//
// Sprint 5.2: every job is brand-scoped (claimNext takes a brandId) and
// claims are atomic (the UPDATE is conditioned on status still being
// 'queued', so two callers racing for the same job can never both win it).
//
// Observability (started_at/finished_at/error on jobs, the brand_locks
// table + acquire_brand_lock() RPC) comes from supabase/005_execution_engine.sql.
// Core status transitions (queued/running/done/failed) never depend on that
// migration -- only the extra timing/lock columns do, and those are written
// best-effort so this file works unchanged before the migration is applied.

import { db } from "./supabase";

export type JobKind =
  | "plan"
  | "content"
  | "geo"
  | "gbp"
  | "citations"
  | "audit"
  | "performance"
  | "rank_sync"
  | "rank_enrich"
  // Applies an approved draft to the brand's LIVE site via lib/execution.
  // Every other kind above produces a row for a human to read; this is the
  // only kind that changes something outside this platform.
  | "publish";

export type Job = { id: string; brand_id: string; kind: JobKind; payload: Record<string, unknown> };

export async function enqueue(brandId: string, kind: JobKind, payload: Record<string, unknown> = {}) {
  await db.from("jobs").insert({ brand_id: brandId, kind, payload, status: "queued" });
}

// How many jobs of the given kinds are already queued/running for a brand --
// used to avoid seeding the same job kind twice while one is still pending.
export async function pendingCount(brandId: string, kinds: JobKind[]): Promise<number> {
  const { count } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .in("status", ["queued", "running"])
    .in("kind", kinds);
  return count || 0;
}

export async function queuedCount(brandId: string): Promise<number> {
  const { count } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .in("status", ["queued", "running"]);
  return count || 0;
}

// Grab the oldest queued job for ONE brand and atomically mark it running.
export async function claimNext(brandId: string): Promise<Job | null> {
  const { data } = await db
    .from("jobs")
    .select("*")
    .eq("brand_id", brandId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);
  const job = data?.[0];
  if (!job) return null;

  // The WHERE status='queued' makes this the atomic claim: if another
  // caller already flipped this row to 'running', zero rows match and
  // `claimed` comes back empty -- this caller simply lost the race.
  const { data: claimed, error } = await db
    .from("jobs")
    .update({ status: "running" })
    .eq("id", job.id)
    .eq("status", "queued")
    .select()
    .single();
  if (error || !claimed) return null;

  // Best-effort observability -- ignored if started_at doesn't exist yet.
  await db.from("jobs").update({ started_at: new Date().toISOString() }).eq("id", job.id);

  return claimed as Job;
}

// Mark a job finished. Pass an error message for a failed job -- recorded as
// status 'failed' (previously failures were mislabeled 'done', hiding them).
export async function finishJob(id: string, errorMsg?: string) {
  const status = errorMsg ? "failed" : "done";
  await db.from("jobs").update({ status }).eq("id", id);

  // Best-effort observability -- ignored if these columns don't exist yet.
  await db.from("jobs").update({ finished_at: new Date().toISOString(), error: errorMsg ?? null }).eq("id", id);
}

// Reclaim jobs stuck "running" for over an hour -- almost certainly a
// crashed invocation -- so one dead job can never block a brand's queue
// forever. Pass a brandId to scope the sweep to one tenant (used by the
// brand-scoped /api/run so a customer's request never touches another
// tenant's job rows); omit it for the global sweep used by trusted
// cron/admin flows.
export async function clearStale(brandId?: string) {
  const cutoff = new Date(Date.now() - 3600_000).toISOString();
  let query = db
    .from("jobs")
    .select("id")
    .eq("status", "running")
    .lt("created_at", cutoff);
  if (brandId) query = query.eq("brand_id", brandId);

  const { data: stale } = await query;
  const ids = (stale || []).map((j) => j.id as string);
  if (!ids.length) return;

  await db.from("jobs").update({ status: "failed" }).in("id", ids);

  // Best-effort observability -- ignored if these columns don't exist yet.
  await db
    .from("jobs")
    .update({ error: "stale: reclaimed after 1h timeout", finished_at: new Date().toISOString() })
    .in("id", ids);
}

// -- Brand-level execution lock (Sprint 5.2) --------------------------------
// Guards the "should I seed new work for this brand right now" decision so a
// duplicate click or an overlapping cron tick can't start two pipelines for
// the same brand at once.

// PostgREST/Postgres error codes that specifically mean "the migration
// hasn't been applied yet" (function or table not found) -- the only case
// where it's safe to proceed WITHOUT the lock. Any other error is treated
// as unknown/unsafe and fails closed.
const MIGRATION_MISSING_CODES = new Set([
  "PGRST202", // PostgREST: function not found in schema cache
  "PGRST205", // PostgREST: table not found in schema cache
  "42883",    // Postgres: undefined_function
  "42P01",    // Postgres: undefined_table
]);

export async function acquireBrandLock(brandId: string, ttlSeconds: number): Promise<boolean> {
  const { data, error } = await db.rpc("acquire_brand_lock", {
    p_brand_id: brandId,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) {
    if (MIGRATION_MISSING_CODES.has(error.code)) return true; // not migrated yet -- proceed without exclusivity
    return false; // unexpected error -- fail SAFE (deny the lock) rather than silently proceeding
  }
  return !!data;
}

export async function releaseBrandLock(brandId: string): Promise<void> {
  await db.from("brand_locks").delete().eq("brand_id", brandId);
}
