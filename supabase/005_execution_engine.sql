-- ============================================================
-- SPRINT 5.2: AUTONOMOUS CRON ENGINE
-- Brand-level execution locking + job/run observability.
-- Apply in the Supabase SQL editor. Entirely additive/idempotent —
-- safe to run against the live project as-is.
--
-- Application code (lib/queue.ts, lib/runner.ts) is written to degrade
-- gracefully if this hasn't been applied yet: locking fails open (runs
-- proceed without exclusivity) and the new observability columns are
-- written best-effort, so nothing breaks in the interim — but neither
-- feature is actually active until this file has been run.
-- ============================================================

-- ── Brand-level execution lock ──────────────────────────────────────────────
-- Guards the "should I seed new work for this brand right now" decision so a
-- duplicate click or an overlapping cron tick can't start two pipelines for
-- the same brand at once. Self-healing: a lock past its expires_at is simply
-- overwritten by the next acquire attempt, so a crashed process can never
-- leave a brand stuck locked forever (no separate cleanup job needed).
create table if not exists brand_locks (
  brand_id uuid primary key references brands(id) on delete cascade,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table brand_locks enable row level security;
-- No policies — service-role only (used server-side in lib/supabase.ts),
-- same convention as jobs/profiles/lessons in 004_reconcile_prod_schema.sql.

-- Atomic acquire: inserts if free, or steals the lock if the existing one has
-- expired. Returns true only when THIS call actually took the lock — callers
-- must treat false as "another execution currently owns this brand."
create or replace function acquire_brand_lock(p_brand_id uuid, p_ttl_seconds int)
returns boolean
language plpgsql
as $$
declare
  acquired boolean;
begin
  insert into brand_locks (brand_id, locked_at, expires_at)
  values (p_brand_id, now(), now() + make_interval(secs => p_ttl_seconds))
  on conflict (brand_id) do update
    set locked_at = now(), expires_at = now() + make_interval(secs => p_ttl_seconds)
    where brand_locks.expires_at < now()
  returning true into acquired;
  return coalesce(acquired, false);
end;
$$;

-- ── Job observability (lib/queue.ts) ────────────────────────────────────────
-- status now also takes the value 'failed' (was previously mislabeled 'done'
-- on both real failures and stale/timed-out reclaims).
alter table jobs
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists duration_ms int,
  add column if not exists error text;

-- ── Run observability (lib/runner.ts) ───────────────────────────────────────
-- runs.status/tasks_planned/drafts_produced/error already existed; this adds
-- the timing + in-flight-progress fields and is what finally lets a run be
-- marked done/error instead of sitting at 'running' forever.
alter table runs
  add column if not exists finished_at timestamptz,
  add column if not exists duration_ms int,
  add column if not exists last_step text;

-- runs had no index at all before this migration. lib/runner.ts now filters
-- on (brand_id, status='running') on every single job completion
-- (touchRunProgress, finalizeOpenRuns), not just once per pipeline, so this
-- is a real hot path.
create index if not exists runs_brand_status_idx
  on runs (brand_id, status);
