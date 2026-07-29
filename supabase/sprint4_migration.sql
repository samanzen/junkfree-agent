-- ============================================================
-- SPRINT 4: SEO INTELLIGENCE CENTER
-- Migration: new tables, column extensions, RLS policies
-- Apply in Supabase SQL editor.
-- ============================================================

-- ── 1. EXTEND EXISTING TABLES ────────────────────────────────

-- Extend metric_snapshots with backlink velocity columns.
-- The confirmed backlinksSummary() API returns backlinks + referring_domains (already stored).
-- new/lost velocity requires a Backlinks API plan; columns are nullable and shown as
-- "Requires Backlinks API" in the UI when null.
alter table metric_snapshots
  add column if not exists new_backlinks_30d int,
  add column if not exists lost_backlinks_30d int;

-- Extend brands with revenue configuration and server-side summary cache.
-- Revenue estimates only computed when all three rate columns are non-null.
alter table brands
  add column if not exists avg_job_value numeric,          -- e.g. 350 (CAD)
  add column if not exists lead_conversion_rate numeric,   -- e.g. 0.30 (30%)
  add column if not exists visitor_lead_rate numeric;      -- e.g. 0.02 (2%)

-- Extend reports table to serve as server-side AI summary cache.
-- Keyed on (brand_id, section, cache_expires_at).
alter table reports
  add column if not exists section text,        -- overview|keywords|content|backlinks
  add column if not exists cache_expires_at timestamptz;

create index if not exists reports_cache_idx
  on reports (brand_id, section, cache_expires_at desc)
  where section is not null;

-- ── 2. TRACKED KEYWORDS ──────────────────────────────────────

create table if not exists tracked_keywords (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade not null,
  keyword text not null,

  -- DataForSEO enrichment (refreshed weekly via rank_enrich job).
  -- All nullable; enriched_at is null until first enrichment run.
  search_volume int,
  keyword_difficulty int,       -- 0-100; null = not yet enriched
  search_intent text,           -- informational|commercial|transactional|navigational; null = not enriched
  cpc numeric,

  -- AI intelligence computed by Claude during rank_enrich.
  ai_opportunity_score int,     -- 0-100
  ai_opportunity_reason text,   -- one-sentence explanation

  -- Traffic opportunity (always computable from search_volume + position CTR curve).
  -- Revenue opportunity only populated when brand.avg_job_value etc. are configured.
  estimated_monthly_clicks int,
  estimated_revenue_impact text, -- null = "Not configured"

  -- Position lifetime tracking (built up from daily syncs over time).
  best_position numeric,
  best_position_date date,
  worst_position numeric,
  first_seen_date date,          -- date keyword first appeared in GSC data
  last_seen_date date,           -- null = currently ranking

  -- Status computed after each rank_sync.
  status text not null default 'new',
    -- new | improving | stable | declining | lost | recovered
  source text not null default 'gsc',
    -- gsc | manual | agent | competitor_gap

  added_at timestamptz not null default now(),
  enriched_at timestamptz,       -- null = needs enrichment

  unique (brand_id, keyword)
);

create index if not exists tk_brand_status_idx
  on tracked_keywords (brand_id, status);
create index if not exists tk_brand_opportunity_idx
  on tracked_keywords (brand_id, ai_opportunity_score desc nulls last);
create index if not exists tk_brand_volume_idx
  on tracked_keywords (brand_id, search_volume desc nulls last);
create index if not exists tk_brand_enriched_idx
  on tracked_keywords (brand_id, enriched_at asc nulls first);

-- ── 3. KEYWORD POSITIONS ─────────────────────────────────────

-- One row per (brand, keyword, date). Genuine ranking measurements only.
-- Timeline events are stored separately in seo_action_events and overlaid
-- on charts by the API — they are never mixed into this table.
create table if not exists keyword_positions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade not null,
  keyword_id uuid references tracked_keywords(id) on delete cascade not null,
  keyword text not null,         -- denormalized for fast queries without join
  position numeric,              -- null = not ranking on this date (row inserted to mark loss)
  clicks int,
  impressions int,
  ctr numeric,
  landing_page text,
  captured_date date not null default current_date,

  unique (brand_id, keyword, captured_date)
);

create index if not exists kp_brand_kw_date_idx
  on keyword_positions (brand_id, keyword, captured_date desc);
create index if not exists kp_brand_date_idx
  on keyword_positions (brand_id, captured_date desc);
create index if not exists kp_keyword_id_date_idx
  on keyword_positions (keyword_id, captured_date desc);

-- ── 4. POSITION DISTRIBUTION SNAPSHOTS ───────────────────────

-- Aggregated distribution counts, computed once per sync and stored.
-- Never computed on read — always a pre-aggregated lookup.
create table if not exists position_distribution_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade not null,
  captured_date date not null,
  top_3 int not null default 0,
  top_10 int not null default 0,
  top_20 int not null default 0,
  top_50 int not null default 0,
  top_100 int not null default 0,
  not_ranked int not null default 0,
  new_this_week int not null default 0,
  lost_this_week int not null default 0,
  improved_this_week int not null default 0,
  declined_this_week int not null default 0,
  total_clicks int not null default 0,
  total_impressions int not null default 0,
  avg_ctr numeric,
  unique (brand_id, captured_date)
);

create index if not exists pds_brand_date_idx
  on position_distribution_snapshots (brand_id, captured_date desc);

-- ── 5. SEO ACTION EVENTS ─────────────────────────────────────

-- Decoupled from keyword_positions. These are agent/human actions
-- (content rewrites, meta updates, new pages published) that appear
-- as annotated markers on position history charts.
-- job_id references the jobs table for full agent context.
create table if not exists seo_action_events (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade not null,
  keyword_id uuid references tracked_keywords(id) on delete set null,
  job_id uuid,                   -- references jobs(id) — nullable (manual events have no job)
  page_url text,
  event_type text not null,
    -- content_update | meta_update | new_page | gbp_post |
    -- citation_added | manual_note | algorithm_update
  event_label text not null,     -- short human-readable label for the chart marker
  event_detail text,             -- optional longer description
  occurred_at timestamptz not null default now()
);

create index if not exists sae_brand_date_idx
  on seo_action_events (brand_id, occurred_at desc);
create index if not exists sae_keyword_date_idx
  on seo_action_events (keyword_id, occurred_at desc)
  where keyword_id is not null;
create index if not exists sae_brand_page_idx
  on seo_action_events (brand_id, page_url, occurred_at desc)
  where page_url is not null;

-- ── 6. COMPETITORS ───────────────────────────────────────────

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade not null,
  domain text not null,
  name text,
  active boolean not null default true,
  -- Snapshot of their keyword count (updated during rank_enrich).
  last_keyword_count int,
  last_checked_at timestamptz,
  added_at timestamptz not null default now(),
  unique (brand_id, domain)
);

create index if not exists comp_brand_idx on competitors (brand_id, active);

-- Seed competitors from the existing brands.competitors text column.
-- This runs once; subsequent adds use the UI.
insert into competitors (brand_id, domain, name, active)
select
  b.id,
  trim(unnest(string_to_array(b.competitors, ','))) as domain,
  trim(unnest(string_to_array(b.competitors, ','))) as name,
  true
from brands b
where b.competitors is not null
  and b.competitors != ''
on conflict (brand_id, domain) do nothing;

-- ── 7. ROW LEVEL SECURITY ────────────────────────────────────

-- Enable RLS on all new tables. The service_role key bypasses RLS (used
-- server-side in lib/supabase.ts). The anon key is NOT granted access to
-- any new table — all browser traffic goes through authenticated API routes.

alter table tracked_keywords enable row level security;
alter table keyword_positions enable row level security;
alter table position_distribution_snapshots enable row level security;
alter table seo_action_events enable row level security;
alter table competitors enable row level security;

-- Policy: authenticated users can only see rows belonging to their brand.
-- The profiles table bridges auth.uid() → brand_id.
-- Admin role (profiles.role = 'admin') sees all brands.

create policy "brand_access_tracked_keywords" on tracked_keywords
  using (
    brand_id in (
      select brand_id from profiles where id = auth.uid()
      union
      select id from brands where exists (
        select 1 from profiles where id = auth.uid() and role = 'admin'
      )
    )
  );

create policy "brand_access_keyword_positions" on keyword_positions
  using (
    brand_id in (
      select brand_id from profiles where id = auth.uid()
      union
      select id from brands where exists (
        select 1 from profiles where id = auth.uid() and role = 'admin'
      )
    )
  );

create policy "brand_access_pds" on position_distribution_snapshots
  using (
    brand_id in (
      select brand_id from profiles where id = auth.uid()
      union
      select id from brands where exists (
        select 1 from profiles where id = auth.uid() and role = 'admin'
      )
    )
  );

create policy "brand_access_seo_events" on seo_action_events
  using (
    brand_id in (
      select brand_id from profiles where id = auth.uid()
      union
      select id from brands where exists (
        select 1 from profiles where id = auth.uid() and role = 'admin'
      )
    )
  );

create policy "brand_access_competitors" on competitors
  using (
    brand_id in (
      select brand_id from profiles where id = auth.uid()
      union
      select id from brands where exists (
        select 1 from profiles where id = auth.uid() and role = 'admin'
      )
    )
  );

-- Service role only — no anon grants on any Sprint 4 table.
grant all privileges on table
  tracked_keywords,
  keyword_positions,
  position_distribution_snapshots,
  seo_action_events,
  competitors
to service_role;

-- ── 8. COMMENTS ──────────────────────────────────────────────

comment on table tracked_keywords is
  'Master keyword registry per brand. Enriched weekly via rank_enrich job (DataForSEO volume/difficulty/intent + Claude AI scoring).';
comment on table keyword_positions is
  'Daily ranking measurements only. One row per (brand, keyword, date). Never mixed with event data.';
comment on table position_distribution_snapshots is
  'Pre-aggregated daily position distribution counts. Computed once per rank_sync. Never computed on read.';
comment on table seo_action_events is
  'Agent and human actions (content updates, meta changes, etc.) shown as markers on position history charts. Separate from ranking data.';
comment on table competitors is
  'Competitor domains per brand. Seeded from brands.competitors text column. Extended in Sprint 4 with basic keyword gap analysis.';
comment on column brands.avg_job_value is
  'Average revenue per customer job. Required for revenue opportunity estimates. Null = show traffic opportunity only.';
comment on column brands.lead_conversion_rate is
  'Fraction of leads that become paying customers (e.g. 0.30 = 30%). Required for revenue estimates.';
comment on column brands.visitor_lead_rate is
  'Fraction of organic visitors that become leads (e.g. 0.02 = 2%). Required for revenue estimates.';
