-- ============================================================
-- SLICE 0: EXECUTION HONESTY
--
-- Additive / idempotent. Pins one last-mile writer per brand and stores
-- per-operation execution state on brands (not a new table, not billing
-- capabilities in lib/capabilities.ts).
--
-- Slice 0 does NOT certify anything. site_capabilities holds the map so
-- Autopilot can fail closed (nothing is certified yet) and Slice 1 can
-- later write state='certified' without another schema change.
-- ============================================================

alter table brands
  add column if not exists primary_writer text,
  add column if not exists site_capabilities jsonb not null default '{}'::jsonb;

comment on column brands.primary_writer is
  'Chosen last-mile writer: wordpress | shopify | webhook. Null = legacy; resolve then pin. Never fall through to a different connected publisher when this is set but disconnected.';
comment on column brands.site_capabilities is
  'Per-operation execution state for the primary writer (upsert_page / update_meta). Not a billing capability. Not an agent specialist type. Slice 0 writes supported_unverified | unsupported only.';
