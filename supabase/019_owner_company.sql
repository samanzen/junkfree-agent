-- ============================================================
-- Owner company loop on Feature 01: playbook, publish checks,
-- outcome reports. Additive / idempotent.
-- ============================================================

alter table brands add column if not exists owner_playbook text;

comment on column brands.owner_playbook is
  'Owner standing orders for the SEO Manager. Null means the default playbook from brand fields.';

create table if not exists publish_checks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  url text not null,
  ok boolean not null,
  reason text not null,
  live_title text,
  live_words int,
  change_type text,
  target_keyword text,
  created_at timestamptz not null default now()
);

create index if not exists publish_checks_brand_time_idx
  on publish_checks (brand_id, created_at desc);

alter table publish_checks enable row level security;
revoke all on table publish_checks from anon, authenticated;
grant all privileges on table publish_checks to service_role;

create table if not exists outcome_reports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  event_id uuid,
  page_url text,
  keyword text not null,
  verdict text not null
    check (verdict in ('won','lost','flat','too_soon','not_buyer')),
  lesson text not null,
  clicks_delta int,
  position_delta numeric,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists outcome_reports_brand_event_idx
  on outcome_reports (brand_id, event_id)
  where event_id is not null;

create index if not exists outcome_reports_brand_time_idx
  on outcome_reports (brand_id, created_at desc);

alter table outcome_reports enable row level security;
revoke all on table outcome_reports from anon, authenticated;
grant all privileges on table outcome_reports to service_role;
