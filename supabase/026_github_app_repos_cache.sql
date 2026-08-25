-- 026_github_app_repos_cache.sql
-- Cache authorized repo metadata on pending installs so Confirm can proceed
-- without re-listing when GitHub secondary rate limits are cooling down.

alter table public.github_app_pending_installs
  add column if not exists repos_cache jsonb;
