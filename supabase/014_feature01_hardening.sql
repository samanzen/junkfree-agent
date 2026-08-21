-- ============================================================
-- Feature 01 hardening (forward migration after 013).
-- Idempotent. Safe to run after 013 has already been applied.
-- ============================================================

-- Constrain rollback_status values (includes rolling_back for atomic claim).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'publish_executions_rollback_status_check'
  ) then
    alter table publish_executions
      add constraint publish_executions_rollback_status_check
      check (
        rollback_status is null
        or rollback_status in ('available', 'rolling_back', 'rolled_back', 'failed', 'unsupported')
      );
  end if;
end $$;

-- Optional FKs for observability linkage (nullable; SET NULL on delete).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'publish_executions_run_id_fkey'
  ) then
    alter table publish_executions
      add constraint publish_executions_run_id_fkey
      foreign key (run_id) references runs(id) on delete set null;
  end if;
exception when others then
  -- If runs table shape differs in some envs, skip without failing the file.
  raise notice 'publish_executions.run_id FK skipped: %', SQLERRM;
end $$;

comment on column publish_executions.rollback_status is
  'available | rolling_back | rolled_back | failed | unsupported | null. rolling_back is an atomic claim lock.';
