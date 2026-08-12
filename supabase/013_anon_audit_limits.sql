-- ============================================================
-- PUBLIC AUDIT ABUSE LIMITS
--
-- NOT YET APPLIED. Apply in the Supabase SQL editor when you are ready.
-- Entirely additive/idempotent, and safe to re-run.
--
-- Why a second table instead of reusing rate_limits: rate_limits.brand_id is
-- `references brands(id)`, which is correct for tenant metering and makes it
-- structurally unable to hold a counter for an anonymous visitor who has no
-- brand. Widening that FK to accommodate strangers would weaken a tenant
-- guarantee to serve a marketing endpoint. A separate table keyed by a hashed
-- client identifier keeps both concerns intact.
--
-- The application degrades safely if this has NOT been applied: lib/audit/limit
-- treats "function not found" as "no shared counter available" and falls back
-- to a per-instance in-memory limiter, exactly like lib/rateLimit.ts and
-- lib/queue.ts do for their own RPCs. Deploying the code before this SQL is
-- therefore safe, but the limit is weaker (per serverless instance) until it
-- is applied.
-- ============================================================

-- `client_hash` is a SHA-256 of the client IP plus a server-side salt, never a
-- raw IP: this table should not become a log of who visited the marketing site.
create table if not exists anon_audit_limits (
  client_hash text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (client_hash, window_start)
);

create index if not exists anon_audit_limits_window_idx
  on anon_audit_limits (window_start);

alter table anon_audit_limits enable row level security;

-- Service-role only, same convention as rate_limits/jobs/brand_integrations.
revoke all on table anon_audit_limits from public;
revoke all on table anon_audit_limits from anon, authenticated;
grant all privileges on table anon_audit_limits to service_role;

-- ------------------------------------------------------------
-- Atomically consume one audit and report whether it was allowed.
--
-- Same atomicity reasoning as consume_rate_limit: the increment is one
-- statement, so concurrent callers serialise on the primary-key row lock
-- instead of racing a read-then-write.
--
-- SECURITY INVOKER (default) and search_path pinned to '' for the same reasons
-- documented in 012_rate_limits.sql.
create or replace function consume_anon_audit(
  p_client_hash text,
  p_window_seconds int,
  p_limit int
)
returns table (allowed boolean, used int, limit_value int, reset_at timestamptz)
language plpgsql
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be > 0 (got %)', p_window_seconds
      using errcode = 'invalid_parameter_value';
  end if;
  if p_limit is null or p_limit <= 0 then
    raise exception 'p_limit must be > 0 (got %)', p_limit
      using errcode = 'invalid_parameter_value';
  end if;
  -- Bound the key length so a hostile caller cannot store large blobs here.
  if p_client_hash is null or pg_catalog.length(p_client_hash) not between 16 and 128 then
    raise exception 'p_client_hash must be a 16-128 character digest'
      using errcode = 'invalid_parameter_value';
  end if;

  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(
      pg_catalog.date_part('epoch', pg_catalog.now()) / p_window_seconds
    ) * p_window_seconds
  );

  insert into public.anon_audit_limits (client_hash, window_start, count)
  values (p_client_hash, v_window_start, 1)
  on conflict (client_hash, window_start)
    do update set count = public.anon_audit_limits.count + 1
  returning public.anon_audit_limits.count into v_count;

  return query select
    v_count <= p_limit,
    v_count,
    p_limit,
    v_window_start + pg_catalog.make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function consume_anon_audit(text, int, int) from public;
revoke all on function consume_anon_audit(text, int, int) from anon, authenticated;
grant execute on function consume_anon_audit(text, int, int) to service_role;

-- ------------------------------------------------------------
-- Housekeeping. Mirrors prune_rate_limits, including its refusal to delete
-- windows that could still be live.
create or replace function prune_anon_audit_limits(p_older_than_hours int default 24)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_deleted int;
begin
  if p_older_than_hours is null or p_older_than_hours < 1 then
    raise exception 'p_older_than_hours must be >= 1 (got %)', p_older_than_hours
      using errcode = 'invalid_parameter_value';
  end if;

  delete from public.anon_audit_limits
    where window_start < pg_catalog.now() - pg_catalog.make_interval(hours => p_older_than_hours);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function prune_anon_audit_limits(int) from public;
revoke all on function prune_anon_audit_limits(int) from anon, authenticated;
grant execute on function prune_anon_audit_limits(int) to service_role;

comment on table anon_audit_limits is
  'Fixed-window counters for the public /api/audit endpoint, keyed by a salted hash of the client IP (never a raw IP). Written only through consume_anon_audit(); pruned by prune_anon_audit_limits().';
