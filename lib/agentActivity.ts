// AGENT ACTIVITY — read-only view of what the platform has actually been doing.
//
// The product runs a real job queue (lib/queue.ts): every unit of agent work is
// a `jobs` row that moves queued -> running -> done|failed. None of that has
// ever been visible to the customer, so a platform that genuinely operates
// autonomously reads as a static reporting dashboard.
//
// Deliberately additive and read-only, matching lib/runHealth.ts and
// lib/scheduling.ts: a new SELECT against the existing table, degrading to an
// empty result on any error rather than throwing, so a lookup failure can never
// stop a page rendering.
//
// NOTHING here invents data:
//   - status comes from jobs.status, the same column the runner writes
//   - timings come from started_at/finished_at/duration_ms, added by
//     supabase/005_execution_engine.sql and written best-effort by the queue.
//     They are OPTIONAL on purpose — the queue's own comments note it works
//     unchanged before that migration is applied — so every timing field here
//     is nullable and the UI omits what is absent rather than estimating it.

import { db } from "./supabase";
import type { JobKind } from "./queue";

export type ActivityStatus = "queued" | "running" | "done" | "failed";

export type AgentActivityItem = {
  id: string;
  kind: JobKind;
  status: ActivityStatus;
  created_at: string;
  /** Present only once the job has been claimed. */
  started_at: string | null;
  /** Present only once the job has settled. */
  finished_at: string | null;
  /** Written by the runner on completion; null before 005 is applied. */
  duration_ms: number | null;
  /** Failure reason, only ever set on failed jobs. */
  error: string | null;
};

export type AgentActivity = {
  items: AgentActivityItem[];
  counts: Record<ActivityStatus, number>;
  /** True when anything is queued or running right now. */
  active: boolean;
};

const EMPTY: AgentActivity = {
  items: [],
  counts: { queued: 0, running: 0, done: 0, failed: 0 },
  active: false,
};

const STATUSES: ActivityStatus[] = ["queued", "running", "done", "failed"];

function isStatus(v: unknown): v is ActivityStatus {
  return typeof v === "string" && (STATUSES as string[]).includes(v);
}

/**
 * Most recent agent jobs for one brand, newest first.
 *
 * Ordered by created_at rather than finished_at so that queued and running
 * work — which has no finish time yet — is not silently excluded. That is
 * exactly the work a customer most wants to see.
 */
export async function recentAgentActivity(brandId: string, limit = 8): Promise<AgentActivity> {
  const { data, error } = await db
    .from("jobs")
    .select("id, kind, status, created_at, started_at, finished_at, duration_ms, error")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return EMPTY;

  const items: AgentActivityItem[] = data
    .filter((r) => isStatus(r.status) && r.created_at)
    .map((r) => ({
      id: String(r.id),
      kind: r.kind as JobKind,
      status: r.status as ActivityStatus,
      created_at: String(r.created_at),
      started_at: (r.started_at as string | null) ?? null,
      finished_at: (r.finished_at as string | null) ?? null,
      duration_ms: typeof r.duration_ms === "number" ? r.duration_ms : null,
      error: (r.error as string | null) ?? null,
    }));

  const counts: Record<ActivityStatus, number> = { queued: 0, running: 0, done: 0, failed: 0 };
  for (const i of items) counts[i.status] += 1;

  return { items, counts, active: counts.queued > 0 || counts.running > 0 };
}

// ── Presentation helpers ────────────────────────────────────────────────────
//
// Job kinds are internal vocabulary ("geo", "rank_enrich"). Customers get a
// plain description of the work, consistent with the portal's existing rule
// that it shows no agent terminology.

const KIND_LABEL: Record<string, string> = {
  plan: "Planning this month's work",
  content: "Writing content",
  geo: "Checking AI assistant answers",
  gbp: "Drafting Google Business posts",
  citations: "Checking business listings",
  audit: "Auditing site health",
  performance: "Reading Search Console performance",
  rank_sync: "Refreshing keyword rankings",
  rank_enrich: "Enriching keyword data",
  publish: "Publishing an approved change",
};

/** Plain-English description of a job kind, never the raw kind. */
export function describeKind(kind: string): string {
  return KIND_LABEL[kind] ?? "Background work";
}

/**
 * Compact elapsed/duration label, or null when the platform genuinely does not
 * know. Returning null rather than "0s" is the point: an unmeasured job must
 * not be dressed up as an instant one.
 */
export function describeTiming(
  // Structural, not the full row: the client re-declares this shape in
  // app/portal/_data.ts with `kind: string` (it has no reason to import the
  // server's JobKind union), and this helper never looks at `kind`.
  item: Pick<AgentActivityItem, "status" | "started_at" | "finished_at" | "duration_ms">,
  now = Date.now(),
): string | null {
  if (item.status === "running" && item.started_at) {
    return formatDuration(now - Date.parse(item.started_at));
  }
  if (item.status === "done" || item.status === "failed") {
    if (item.duration_ms != null) return formatDuration(item.duration_ms);
    if (item.started_at && item.finished_at) {
      return formatDuration(Date.parse(item.finished_at) - Date.parse(item.started_at));
    }
  }
  return null;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** "4m ago", "2h ago", "3d ago" — how fresh this is. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - Date.parse(iso);
  if (!Number.isFinite(diff)) return "";
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
