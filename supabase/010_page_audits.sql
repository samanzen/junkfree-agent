-- ============================================================
-- PHASE 5: PERSISTENT TECHNICAL SEO DATASET
--
-- Until now lib/auditor.ts fetched every sampled page, extracted its
-- title / meta / h1 / word count, handed them to the AI for issue
-- analysis, and then DISCARDED the raw per-page data. Only an aggregate
-- {score, audited, issue_count} survived, in `reports`.
--
-- This table keeps that per-page output permanently, so the Technical SEO
-- module reads a real dataset instead of a transient runtime value, and so
-- checks that need cross-page comparison (duplicate titles, duplicate H1s)
-- become possible at all.
--
-- Every column below is something the auditor genuinely observes while
-- fetching the page. Nothing is inferred or invented. Fields the auditor
-- does not collect (image alt text, page weight, Core Web Vitals, index
-- coverage) are deliberately absent rather than added as nullable columns
-- that would never be filled.
-- ============================================================

create table if not exists page_audits (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade not null,

  -- Identity
  url text not null,

  -- Observed directly from the HTTP response
  http_status int,                       -- res.status at fetch time
  in_sitemap boolean not null default true, -- audited URLs are sourced from the sitemap

  -- Extracted from the HTML the auditor already downloads
  title text,
  meta_description text,
  h1 text,
  canonical text,                        -- <link rel="canonical" href="...">
  robots_meta text,                      -- <meta name="robots" content="...">
  word_count int,

  -- Single-row derivable flags. GENERATED so they can never drift out of
  -- sync with the values above. Cross-page checks (duplicate title / meta /
  -- h1) are intentionally NOT stored here: a duplicate is a property of a
  -- SET of rows, not of one row, so it is computed per audit run at read
  -- time instead of being frozen incorrectly at write time.
  missing_title boolean generated always as (title is null or btrim(title) = '') stored,
  missing_meta_description boolean generated always as (meta_description is null or btrim(meta_description) = '') stored,
  missing_h1 boolean generated always as (h1 is null or btrim(h1) = '') stored,
  thin_content boolean generated always as (word_count is not null and word_count < 300) stored,

  -- Timing. audit_run_at is identical for every page in one audit pass, so a
  -- run can be selected as a unit and history is preserved across runs.
  fetched_at timestamptz not null default now(),
  audit_run_at timestamptz not null default now()
);

-- Newest run per brand is the hot path.
create index if not exists page_audits_brand_run_idx
  on page_audits (brand_id, audit_run_at desc);

-- Per-URL history lookups.
create index if not exists page_audits_brand_url_idx
  on page_audits (brand_id, url, audit_run_at desc);

alter table page_audits enable row level security;

-- No anon/authenticated policies: reads happen server-side through the
-- service-role client in the API route, exactly like every other table in
-- this schema (see supabase/006_brand_integrations.sql).
revoke all on table page_audits from anon, authenticated;
grant all privileges on table page_audits to service_role;
