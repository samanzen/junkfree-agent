-- ============================================================
-- RECONCILIATION MIGRATION
-- Written 2026-07-30 after introspecting the live Supabase project.
--
-- Four tables (jobs, profiles, lessons, metric_snapshots) and one column
-- (drafts.feedback) are used throughout lib/ and app/api/ but were never
-- captured in schema.sql / platform.sql / sprint4_migration.sql. They
-- already exist in production with the shapes below (confirmed via
-- information_schema + pg_policies introspection) — this file does not
-- change production data or behavior. Its purpose is purely so a fresh
-- database (new environment, disaster recovery, local dev) ends up with
-- the same schema production already has.
--
-- Entirely additive/idempotent: `create table if not exists`, `add column
-- if not exists`, `create index if not exists`. Safe to run against the
-- live project as-is.
-- ============================================================

-- ── jobs — backs the queue system (lib/queue.ts, lib/steps.ts) ──────────────

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  kind text not null,
  payload jsonb default '{}'::jsonb,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

create index if not exists jobs_status_created_idx on jobs (status, created_at);
create index if not exists jobs_brand_idx on jobs (brand_id);

alter table jobs enable row level security;
-- No policies: only the service-role key (used server-side in lib/supabase.ts)
-- reads/writes this table, and it bypasses RLS. Matches production today.

-- ── profiles — bridges auth.uid() to role + brand (app/api/me, lib/auth) ────

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer',
  brand_id uuid references brands(id),
  created_at timestamptz not null default now()
);

create index if not exists profiles_brand_idx on profiles (brand_id);

alter table profiles enable row level security;
-- No policies: profile lookups happen server-side via the service-role
-- client in requireAuth(); the client never queries this table directly.

-- ── lessons — the learning loop (lib/learning.ts) ───────────────────────────

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  lesson text not null,
  created_at timestamptz not null default now()
);

create index if not exists lessons_brand_created_idx on lessons (brand_id, created_at desc);

alter table lessons enable row level security;

-- ── metric_snapshots — Overview tab KPIs (lib/metrics.ts) ───────────────────

create table if not exists metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  organic_traffic int,
  organic_keywords int,
  backlinks int,
  referring_domains int,
  striking_distance int,
  avg_position numeric,
  ai_visibility int,
  site_health int,
  captured_at timestamptz not null default now(),
  new_backlinks_30d int,
  lost_backlinks_30d int
);

create index if not exists metric_snapshots_brand_captured_idx on metric_snapshots (brand_id, captured_at desc);

alter table metric_snapshots enable row level security;

-- ── drafts.feedback — owner feedback thread (app/api/drafts/[id]/revise) ────

alter table drafts add column if not exists feedback jsonb default '[]'::jsonb;

-- ── Hardening: remove stale broad grants from platform.sql ──────────────────
-- platform.sql granted anon/authenticated full privileges on these 5 tables.
-- RLS is enabled on all of them with no policies, so this grant is a no-op
-- today (RLS default-denies without a policy) — but it's a landmine if a
-- permissive policy is ever added carelessly, or RLS is ever toggled off.
-- Revoking it costs nothing (service_role is unaffected) and removes the risk.

revoke all on table brands, citations, gbp_posts, review_responses, reports
  from anon, authenticated;