-- 025_github_app_connection.sql
-- GitHub App install attempts (CSRF / replay) + pending installs awaiting repo selection.
-- Connected installation/repo IDs live in brand_integrations.metadata (authType=github_app).

create table if not exists public.github_app_auth_attempts (
  nonce text primary key,
  brand_id uuid not null references public.brands (id) on delete cascade,
  user_id uuid not null,
  origin text not null,
  site_url text,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  installation_id bigint
);

create index if not exists github_app_auth_attempts_brand_idx
  on public.github_app_auth_attempts (brand_id, created_at desc);

alter table public.github_app_auth_attempts enable row level security;

create table if not exists public.github_app_pending_installs (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  user_id uuid not null,
  installation_id bigint not null,
  account_login text not null,
  account_type text not null default 'User',
  account_id bigint not null default 0,
  site_url text,
  created_at timestamptz not null default now()
);

alter table public.github_app_pending_installs enable row level security;

-- Service role needs table grants (RLS bypass ≠ GRANT). Mirrors 009_brand_locks pattern.
grant select, insert, update, delete on table public.github_app_auth_attempts to service_role;
grant select, insert, update, delete on table public.github_app_pending_installs to service_role;
