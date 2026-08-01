-- ============================================================
-- SPRINT 6.2 PHASE 1: BUSINESS MODEL CLASSIFICATION (FOUNDATION)
-- Gives every brand a business_model + a real target-geography so later
-- phases can skip local-only work (GBP posts, citations) and stop
-- hardcoding DataForSEO to Canada for non-local/non-Canadian brands.
-- Apply in the Supabase SQL editor. Entirely additive/idempotent -- safe
-- to run against the live project as-is.
--
-- This migration does NOT change any pipeline behavior by itself -- it
-- only adds columns and backfills existing brands with values that
-- reproduce their current behavior exactly. Junk Free and POMO BUILD both
-- become business_model='local_service', dataforseo_location_code=2124
-- (Canada), which is what lib/dataforseo.ts already hardcodes for every
-- brand today.
-- ============================================================

-- Free-text, not a Postgres enum -- same convention as brand_integrations.provider
-- (supabase/006_brand_integrations.sql): keeps this open to new verticals without
-- a migration. lib/brands.ts's BusinessModel union is the source of truth for
-- which values the application currently understands:
--   local_service | ecommerce | saas | national_brand | content_publisher
alter table brands
  add column if not exists business_model text not null default 'local_service';

-- DataForSEO location/language targeting, per brand. Nullable location_code:
-- until backfilled below (or for a brand that genuinely has no single target
-- market), callers fall back to the existing Canada default in lib/dataforseo.ts.
alter table brands
  add column if not exists dataforseo_location_code int,
  add column if not exists dataforseo_language_code text not null default 'en';

-- Backfill existing brands to reproduce today's hardcoded behavior exactly
-- (lib/dataforseo.ts's LOCATION_CANADA = 2124). Only touches rows that don't
-- already have a location code, so re-running this file is safe.
update brands
  set dataforseo_location_code = 2124
  where dataforseo_location_code is null;

comment on column brands.business_model is
  'Vertical classification (Sprint 6.2). Drives whether local-only pipeline steps (GBP posts, citations) run and which content playbook is used. Free text by design -- see lib/brands.ts BusinessModel for the values the app understands. Default/backfill: local_service (preserves pre-Sprint-6.2 behavior for all existing brands).';
comment on column brands.dataforseo_location_code is
  'DataForSEO location_code for this brand''s target market (e.g. 2124 = Canada). Null = caller falls back to the platform default. Backfilled to 2124 for all brands that existed before Sprint 6.2.';
comment on column brands.dataforseo_language_code is
  'DataForSEO language_code for this brand''s target market (e.g. "en"). Defaults to "en" for every brand, matching current hardcoded behavior.';
