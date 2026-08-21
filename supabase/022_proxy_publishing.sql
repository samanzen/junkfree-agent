-- ============================================================
-- PROXY-HOSTED SUBDIRECTORY PUBLISHING
--
-- Additive / idempotent. Fourth primary_writer value: "proxy".
-- primary_writer stays free text (no Postgres enum), per 020.
--
-- Token lives on brands (hot path: public origin resolves
-- /s/{token}/* → brand per request). No brand_integrations row —
-- there is no encrypted credential; the token is the credential.
-- Connections UI synthesizes the proxy entry from these columns.
--
-- Before apply: confirm no prod row has primary_writer = 'proxy'
-- (brands_proxy_writer_complete would fail). None should exist yet.
-- ============================================================

alter table brands
  add column if not exists proxy_site_token text,
  add column if not exists proxy_namespace text,
  add column if not exists proxy_claim_check jsonb not null default '{}'::jsonb,
  add column if not exists proxy_token_rotated_at timestamptz;

-- Public origin resolves /s/{token}/* → brand. Must be unique + indexed.
create unique index if not exists brands_proxy_site_token_key
  on brands (proxy_site_token)
  where proxy_site_token is not null;

-- Namespace: bare slug, lowercase, no slashes. App renders "/guides/".
-- Reserved names blocked to avoid shadowing real site routes.
alter table brands
  drop constraint if exists brands_proxy_namespace_format;

alter table brands
  add constraint brands_proxy_namespace_format check (
    proxy_namespace is null
    or (
      proxy_namespace ~ '^[a-z0-9][a-z0-9-]{1,30}$'
      and proxy_namespace not in (
        'api','admin','wp-admin','wp-content','wp-json','static','assets',
        '_next','cdn','app','login','cart','checkout','account','s'
      )
    )
  );

-- Token format: prefix + 32 hex chars, e.g. site_9f3a...
alter table brands
  drop constraint if exists brands_proxy_site_token_format;

alter table brands
  add constraint brands_proxy_site_token_format check (
    proxy_site_token is null
    or proxy_site_token ~ '^site_[0-9a-f]{32}$'
  );

-- A brand pinned to proxy must have both token and namespace.
alter table brands
  drop constraint if exists brands_proxy_writer_complete;

alter table brands
  add constraint brands_proxy_writer_complete check (
    primary_writer is distinct from 'proxy'
    or (proxy_site_token is not null and proxy_namespace is not null)
  );

comment on column brands.proxy_site_token is
  'Opaque per-brand token in the rewrite destination: /s/{token}/*. Rotate via proxy_token_rotated_at. Generated in app code.';
comment on column brands.proxy_namespace is
  'Bare slug of the owned path segment (e.g. "guides"). Rendered as /{namespace}/.';
comment on column brands.proxy_claim_check is
  'Last namespace claim-check result. Shape: { namespace, result, probes[], checked_at, detail }.';
comment on column brands.proxy_token_rotated_at is
  'When proxy_site_token was last rotated. Null until first token is issued.';
