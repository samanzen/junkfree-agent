// Read-only job-failure lookup for the admin Brands tab (Sprint 6.6 Phase 1).
//
// Sprint 6.4's "last run" badge (lib/scheduling.ts's lastCompletedRunMap)
// tells an admin WHEN a brand last succeeded. It says nothing about WHY a
// brand hasn't succeeded recently. lib/runner.ts's finalizeOpenRuns marks a
// run status='error' when jobs failed, but writes error: null -- the actual
// per-job failure reason lives on jobs.error (Sprint 5.2's
// 005_execution_engine.sql) and is never read back out anywhere.
//
// Deliberately NOT fixed by changing what finalizeOpenRuns writes -- that
// would require editing lib/runner.ts, which is frozen (Sprint 6.1). Instead,
// same pattern as lib/scheduling.ts: a new, additive, read-only query
// against the existing jobs table.

import { db } from "./supabase";
import type { JobKind } from "./queue";

export type JobFailure = { kind: JobKind; error: string; finished_at: string };

// Most recent failed jobs for a brand, newest first. Degrades to [] on any
// DB error (never throws) -- same convention as lib/scheduling.ts's
// functions, so a lookup failure never blocks the admin view from rendering.
export async function recentJobFailures(brandId: string, limit = 5): Promise<JobFailure[]> {
  const { data, error } = await db
    .from("jobs")
    .select("kind, error, finished_at")
    .eq("brand_id", brandId)
    .eq("status", "failed")
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) return [];

  return (data || [])
    .filter((row) => row.error && row.finished_at)
    .map((row) => ({
      kind: row.kind as JobKind,
      error: row.error as string,
      finished_at: row.finished_at as string,
    }));
}
