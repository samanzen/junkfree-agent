-- ============================================================
-- PHASE 1.6: TENANT-AWARE RATE LIMITING
-- Apply in the Supabase SQL editor. Entirely additive/idempotent -- safe to
-- run against the live project as-is, and safe to re-run.
--
-- Why a table and not in-process counters: the app runs on serverless
-- instances with no shared memory, so a counter held in a module would be
-- per-instance and would not limit anything in aggregate. Why not an external
-- KV: that is a new vendor for a problem Postgres already solves at this
-- scale, and lib/queue.ts has already established the RPC pattern below.
--
-- The application degrades safely if this migration has NOT been applied:
-- lib/rateLimit.ts treats "function not found" as "no limiting configured"
-- and allows the request, exactly like acquireBrandLock() does for
-- acquire_brand_lock. So deploying the code before this SQL is harmless.
-- ============================================================

-- One row per (tenant, bucket, window). A fixed window is deliberate: it is
-- one row per tenant per bucket per period, which stays small and is trivially
-- prunable, where a sliding log would be one row per REQUEST.
create table if not exists rate_limits (
  brand_id uuid not null references brands(id) on delete cascade,
  -- Route class, not route path: an AI call and a cheap read should not share
  -- a budget, but every AI route can. See RateBucket in lib/rateLimit.ts.
  bucket text not null,
  -- Start of the fixed window this counter belongs to.
  window_start timestamptz not null,
  count int not null default 0,
  primary key (brand_id, bucket, window_start)
);

-- Whitelist the bucket names in the DATABASE, not only in the function.
-- A constraint holds no matter how a row arrives; validation inside one
-- function only holds for callers who use that function. Without it, a
-- malformed or hostile caller could mint unlimited distinct bucket values and
-- grow this table without bound.
--
-- Added separately (rather than inline) so re-running this file against an
-- existing table still installs it.
do $$
begin
  -- Scoped to this relation: conname is unique per table, NOT globally, so a
  -- same-named constraint on any other table would make this skip silently
  -- and leave rate_limits without its whitelist.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rate_limits'::regclass
      and conname = 'rate_limits_bucket_check'
  ) then
    alter table public.rate_limits
      add constraint rate_limits_bucket_check
      check (bucket in ('ai', 'external', 'dispatch'));
  end if;
end $$;

-- The read path is always "this tenant, this bucket, this window", which the
-- primary key already serves. This index covers pruning old windows.
create index if not exists rate_limits_window_idx on rate_limits (window_start);

alter table rate_limits enable row level security;
-- Service-role only, same convention as jobs/brand_locks/brand_integrations.
-- Unreachable from the browser by construction rather than by policy.
revoke all on table rate_limits from public;
revoke all on table rate_limits from anon, authenticated;
grant all privileges on table rate_limits to service_role;

-- ------------------------------------------------------------
-- Atomically consume one unit and report the result.
--
-- ATOMICITY: the increment happens server-side in ONE statement. The
-- alternative -- read, compare, then write from the application -- is a race:
-- two concurrent requests both read count=N, both decide they are under the
-- limit, and both write N+1. `on conflict do update set count = count + 1`
-- takes a row lock on the conflicting primary key, so concurrent callers
-- serialise on it and each applies its +1 to the committed value. RETURNING
-- reads back the row the same statement just wrote, so the value used for the
-- decision cannot be stale.
--
-- SECURITY INVOKER (the default), deliberately NOT security definer. The only
-- caller is the application's service-role client, which already has full
-- rights on rate_limits, so definer rights buy nothing -- while costing the
-- guarantee that a caller without table privileges is refused by the table
-- itself. With invoker rights there are two independent barriers: no EXECUTE
-- grant, and no table privilege even if EXECUTE were somehow obtained.
--
-- search_path is pinned to '' and every object reference is schema-qualified,
-- so no caller-controlled search_path can resolve `rate_limits` to a different
-- table. pg_catalog is always searched implicitly, so the built-ins below
-- still resolve.
--
-- Returns the count AFTER incrementing, so allowed = (new_count <= p_limit).
create or replace function consume_rate_limit(
  p_brand_id uuid,
  p_bucket text,
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
  -- p_window_seconds is a DIVISOR below: zero raises division_by_zero and a
  -- negative value would produce a window running backwards.
  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be > 0 (got %)', p_window_seconds
      using errcode = 'invalid_parameter_value';
  end if;
  if p_limit is null or p_limit <= 0 then
    raise exception 'p_limit must be > 0 (got %)', p_limit
      using errcode = 'invalid_parameter_value';
  end if;
  if p_brand_id is null then
    raise exception 'p_brand_id is required'
      using errcode = 'invalid_parameter_value';
  end if;
  -- Mirrors the table constraint. Both exist on purpose: this gives a clear
  -- error at the boundary, the constraint guarantees it regardless of path.
  if p_bucket is null or p_bucket not in ('ai', 'external', 'dispatch') then
    raise exception 'unknown bucket %', p_bucket
      using errcode = 'invalid_parameter_value';
  end if;

  -- Truncate now() to the start of its fixed window.
  --
  -- date_part('epoch', ...) rather than EXTRACT(EPOCH FROM ...): EXTRACT is
  -- SQL grammar, not a callable function, so it cannot be schema-qualified —
  -- `pg_catalog.extract(epoch from ...)` is a syntax error. date_part is the
  -- ordinary-function equivalent and IS qualifiable, which keeps this line
  -- safe under `search_path = ''` instead of relying on an unqualified name.
  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(
      pg_catalog.date_part('epoch', pg_catalog.now()) / p_window_seconds
    ) * p_window_seconds
  );

  insert into public.rate_limits (brand_id, bucket, window_start, count)
  values (p_brand_id, p_bucket, v_window_start, 1)
  on conflict (brand_id, bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning public.rate_limits.count into v_count;

  return query select
    v_count <= p_limit,
    v_count,
    p_limit,
    v_window_start + pg_catalog.make_interval(secs => p_window_seconds);
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function. Revoking only from
-- anon/authenticated leaves that PUBLIC grant in place, so both roles keep
-- access through it. PUBLIC must be revoked FIRST and explicitly.
revoke all on function consume_rate_limit(uuid, text, int, int) from public;
revoke all on function consume_rate_limit(uuid, text, int, int) from anon, authenticated;
grant execute on function consume_rate_limit(uuid, text, int, int) to service_role;

-- ------------------------------------------------------------
-- Housekeeping: drop windows that can no longer be current. Safe to call from
-- any cron tick; without it the table grows one row per tenant per bucket per
-- window forever.
--
-- This is the more dangerous of the two functions: prune_rate_limits(0) would
-- delete every counter and disable rate limiting platform-wide. Hence the
-- minimum below, invoker rights, and the PUBLIC revoke.
create or replace function prune_rate_limits(p_older_than_hours int default 24)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_deleted int;
begin
  -- Refuse to delete windows that could still be in use. The longest window
  -- configured in lib/rateLimit.ts is one hour, so anything younger than that
  -- may be a live counter.
  if p_older_than_hours is null or p_older_than_hours < 1 then
    raise exception 'p_older_than_hours must be >= 1 (got %)', p_older_than_hours
      using errcode = 'invalid_parameter_value';
  end if;

  delete from public.rate_limits
    where window_start < pg_catalog.now() - pg_catalog.make_interval(hours => p_older_than_hours);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function prune_rate_limits(int) from public;
revoke all on function prune_rate_limits(int) from anon, authenticated;
grant execute on function prune_rate_limits(int) to service_role;

comment on table rate_limits is
  'Fixed-window per-tenant request counters (Phase 1.6). One row per (brand, bucket, window). Written only through consume_rate_limit(); pruned by prune_rate_limits().';
