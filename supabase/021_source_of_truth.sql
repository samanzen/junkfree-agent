-- ============================================================
-- SLICE 1: SOURCE OF TRUTH
--
-- Additive / idempotent. Brand remains the site. Detection may suggest
-- where pages are saved; a human confirms. Confirmed values never include
-- writers we do not implement (git, sanity, ...).
--
-- site_capabilities JSONB from 020 already holds certified | stale |
-- temporarily_failed. This file does not add sites / site_capabilities /
-- site_canaries tables.
-- ============================================================

alter table brands
  add column if not exists source_of_truth jsonb not null default '{}'::jsonb;

comment on column brands.source_of_truth is
  'Detected vs confirmed where new pages are saved. Detection never auto-selects a writer. confirmed: wordpress | shopify | application_database | unknown.';
