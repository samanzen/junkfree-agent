-- ============================================================
-- SITE EXECUTION ENGINE: durable execution log + the missing
-- brand_integrations grant.
--
-- Two things, one file, because they are useless apart: the engine stores its
-- credentials in brand_integrations (which service_role currently cannot read)
-- and its audit trail in publish_executions (which does not exist).
--
-- Entirely additive/idempotent. Safe to run against the live project as-is.
--
-- Application code degrades gracefully if this has NOT been applied:
-- publishing still works, it just has no audit trail, and
-- GET /api/execution reports execution_log.available = false with the reason.
-- The grant below, however, is required before any brand can connect a
-- publishing platform at all.
-- ============================================================

-- ── 1. Fix the brand_integrations grant ─────────────────────────────────────
-- supabase/006_brand_integrations.sql created the table and enabled RLS but
-- never granted service_role the table-level DML privileges it needs. RLS
-- bypass (service_role's BYPASSRLS attribute) is a SEPARATE privilege layer
-- from table GRANTs, and only the latter was missing -- the exact same defect
-- 009_brand_locks_service_role_grant.sql fixed for brand_locks. Verified
-- against the live project: reading brand_integrations returns
-- `42501 permission denied for table brand_integrations`.
grant select, insert, update, delete on table brand_integrations to service_role;

-- ── 2. Execution log ────────────────────────────────────────────────────────
-- One row per attempt to change a customer's live website. This is the only
-- place the platform records that it acted on the outside world, so failures
-- are kept alongside successes rather than being thrown away.
create table if not exists publish_executions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,

  -- Nullable and ON DELETE SET NULL: the record that a page was published must
  -- survive the deletion of the draft it came from.
  draft_id uuid references drafts(id) on delete set null,
  job_id uuid,

  -- Null when resolution failed before an adapter was even chosen (e.g. no
  -- platform connected), which is itself worth recording.
  provider text,
  change_type text not null,          -- upsert_page | update_meta
  target text,                        -- slug or absolute URL the change aimed at

  status text not null,               -- succeeded | failed
  remote_id text,                     -- the platform's own id for the resource
  result_url text,                    -- where the change is live
  error text,

  -- The values this change overwrote, captured at write time. Rollback is not
  -- implemented yet; this column is what makes implementing it possible later,
  -- because prior state is only knowable at the moment of the write.
  previous jsonb,

  executed_at timestamptz not null default now()
);

-- Newest-first per brand is the hot path (status endpoint, future history UI).
create index if not exists publish_executions_brand_time_idx
  on publish_executions (brand_id, executed_at desc);

-- "What happened to this draft" lookups.
create index if not exists publish_executions_draft_idx
  on publish_executions (draft_id, executed_at desc)
  where draft_id is not null;

-- Failure triage without scanning the table.
create index if not exists publish_executions_failures_idx
  on publish_executions (brand_id, executed_at desc)
  where status = 'failed';

alter table publish_executions enable row level security;

-- No anon/authenticated policies: reads happen server-side through the
-- service-role client, exactly like page_audits and brand_integrations.
-- Both the grant AND the revoke are stated explicitly here so this table
-- cannot repeat the 006 defect this same file is fixing above.
revoke all on table publish_executions from anon, authenticated;
grant all privileges on table publish_executions to service_role;

comment on table publish_executions is
  'Audit trail of every attempt to change a customer''s live website through lib/execution. One row per adapter dispatch, successes and failures alike. `previous` holds the overwritten values so rollback can be implemented without re-reading the remote site.';
comment on column publish_executions.previous is
  'Values this change overwrote, as reported by the adapter at write time. Null when the platform cannot report prior state or when the page did not previously exist.';
