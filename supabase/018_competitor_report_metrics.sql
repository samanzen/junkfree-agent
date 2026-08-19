-- ============================================================
-- COMPETITOR REPORT SNAPSHOTS
-- Cached metrics for the Competitors report table (traffic, backlinks,
-- common keywords, keyword gap). Forward-only, idempotent.
-- ============================================================

alter table competitors
  add column if not exists last_organic_traffic int,
  add column if not exists last_backlinks int,
  add column if not exists last_common_keywords int,
  add column if not exists last_keyword_gap int;

comment on column competitors.last_organic_traffic is
  'Estimated organic traffic (DataForSEO etv), refreshed from Competitors report.';
comment on column competitors.last_backlinks is
  'Live backlink count snapshot for Competitors report.';
comment on column competitors.last_common_keywords is
  'Overlap count vs brand tracked keywords.';
comment on column competitors.last_keyword_gap is
  'Keywords they rank for (top 20) that the brand does not track.';
