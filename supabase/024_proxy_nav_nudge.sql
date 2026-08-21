-- ============================================================
-- PROXY CONNECT UI SUPPORT
-- Additive: dismiss timestamp for the nav-link onboarding nudge.
-- ============================================================

alter table brands
  add column if not exists proxy_nav_link_dismissed_at timestamptz;

comment on column brands.proxy_nav_link_dismissed_at is
  'When the owner dismissed the "add a nav/footer link to /{namespace}/" nudge. Null = still show warning.';
