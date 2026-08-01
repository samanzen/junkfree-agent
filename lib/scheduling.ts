// Fair brand ordering for the unattended cron pipeline (Sprint 6.4 Phase 1).
// The cron routes (orchestrate/rank-sync/rank-enrich) share a single time
// budget across every active brand in one tick. Without this, whichever
// brand happens to come first in getActiveBrands()'s arbitrary DB order gets
// first crack at that budget every single day, and a brand skipped today has
// no way to be prioritized tomorrow. Sorting "most overdue first" means a
// skipped brand is first in line next tick instead of skippable indefinitely.
//
// Read-only: queries the existing runs/jobs tables (columns added by Sprint
// 5.2's 005_execution_engine.sql), writes nothing, and never touches
// lib/runner.ts or lib/queue.ts (both frozen from Sprint 6.1).

import { db } from "./supabase";
import type { Brand } from "./brands";
import type { JobKind } from "./queue";

// Sprint 6.4 Phase 2: a fixed per-brand time allotment, replacing the old
// shared countdown that let brand #1 consume however much of the tick it
// wanted before brand #2 got whatever was left (down to zero). A brand that
// needs more than this to fully drain simply leaves jobs queued for the next
// tick (or a manual "Run agents now" click) -- lib/queue.ts/lib/runner.ts
// were already designed for exactly this resumability, so this is not a
// regression, just a fairer distribution of the same total budget.
//
// 15s comfortably covers a single job in the slowest kinds observed in this
// codebase (a writeContent() call at maxTokens:4000, or an auditSite() pass
// crawling up to 12 pages) without being so generous that a handful of slow
// brands could still starve the rest. If real `jobs.duration_ms` data (added
// by Sprint 5.2, queryable directly: `select kind, avg(duration_ms),
// max(duration_ms) from jobs where status='done' group by kind`) shows this
// is too tight or too generous once there's more usage history, this is the
// one constant to retune -- nothing else needs to change.
export const PER_BRAND_BUDGET_MS = 15_000;

// Overall ceiling on how long a single cron tick attempts NEW brands, kept
// well under the 60s function cap -- same total ceiling the old shared
// countdown used. Once elapsed time exceeds this, remaining brands are
// reported skipped for this tick and (per the ordering above) will be first
// in line next tick instead of being skippable indefinitely.
export const TICK_BUDGET_MS = 45_000;

// Brands with no matching row at all (never run, or freshly onboarded via
// Sprint 6.3) sort first -- treated as maximally overdue, not a special case
// to work around.
function sortByLastRun(brands: Brand[], lastRun: Map<string, string>): Brand[] {
  return [...brands].sort((a, b) => {
    const at = lastRun.get(a.id);
    const bt = lastRun.get(b.id);
    if (!at && !bt) return 0;
    if (!at) return -1;
    if (!bt) return 1;
    return new Date(at).getTime() - new Date(bt).getTime();
  });
}

function latestPerBrand(rows: { brand_id: string; finished_at: string }[]): Map<string, string> {
  const lastRun = new Map<string, string>();
  for (const row of rows) {
    const prev = lastRun.get(row.brand_id);
    if (!prev || new Date(row.finished_at) > new Date(prev)) lastRun.set(row.brand_id, row.finished_at);
  }
  return lastRun;
}

// Orchestrate's daily content pipeline: `runs` tracks whole-pipeline
// completion natively (lib/runner.ts's finalizeOpenRuns, Sprint 5.2) -- the
// most semantically correct signal for "did today's run actually finish."
export async function orderByLastCompletedRun(brands: Brand[]): Promise<Brand[]> {
  if (!brands.length) return brands;
  const { data, error } = await db
    .from("runs")
    .select("brand_id, finished_at")
    .eq("status", "done")
    .in("brand_id", brands.map((b) => b.id))
    .not("finished_at", "is", null);
  if (error) return brands; // degrade to unordered rather than fail the tick

  return sortByLastRun(brands, latestPerBrand((data || []) as { brand_id: string; finished_at: string }[]));
}

// rank_sync / rank_enrich never create a `runs` row (only stepPlan does) --
// their own job's finished_at on the `jobs` table is the only completion
// signal available for these two cadences.
export async function orderByLastCompletedJob(brands: Brand[], kind: JobKind): Promise<Brand[]> {
  if (!brands.length) return brands;
  const { data, error } = await db
    .from("jobs")
    .select("brand_id, finished_at")
    .eq("kind", kind)
    .eq("status", "done")
    .in("brand_id", brands.map((b) => b.id))
    .not("finished_at", "is", null);
  if (error) return brands;

  return sortByLastRun(brands, latestPerBrand((data || []) as { brand_id: string; finished_at: string }[]));
}
