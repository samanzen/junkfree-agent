-- Execution-capacity billing + Semrush-competitive signal tables.
-- NOT YET APPLIED — paste into Supabase SQL editor when ready.
-- Code degrades if tables/columns are missing (best-effort selects/inserts).
--
-- brands.plan                 — founding | growth | managed (null = trial → founding caps)
-- ai_visibility_prompts       — prompts we track for AI mention share
-- ai_visibility_checks        — per-run mention results
-- conversion_signals          — leads / calls / conversions snapshots (GA4 or estimated)

alter table brands
  add column if not exists plan text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_status text;

create table if not exists ai_visibility_prompts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  prompt text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (brand_id, prompt)
);

create table if not exists ai_visibility_checks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  prompt text not null,
  engine text not null default 'assistant',
  mentioned boolean not null default false,
  raw_excerpt text,
  captured_at timestamptz not null default now()
);

create index if not exists ai_vis_checks_brand_idx
  on ai_visibility_checks (brand_id, captured_at desc);

create table if not exists conversion_signals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  period_start date,
  period_end date,
  leads int,
  calls int,
  conversions int,
  source text not null default 'ga4',
  captured_at timestamptz not null default now()
);

create index if not exists conversion_signals_brand_idx
  on conversion_signals (brand_id, captured_at desc);

grant all privileges on table ai_visibility_prompts, ai_visibility_checks, conversion_signals
  to service_role;
grant all privileges on table ai_visibility_prompts, ai_visibility_checks, conversion_signals
  to anon, authenticated;
