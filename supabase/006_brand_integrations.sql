-- ============================================================
-- SPRINT 6.1: PER-BRAND INTEGRATION CREDENTIAL SYSTEM (FOUNDATION)
-- Provider-agnostic storage for future per-brand third-party integrations
-- (GA4, HighLevel, Stripe, QuickBooks, Jobber, and anything added later).
-- Apply in the Supabase SQL editor. Entirely additive/idempotent -- safe
-- to run against the live project as-is.
--
-- This migration does NOT implement any provider. It only creates the
-- table every future provider integration will read/write through
-- lib/integrations.ts. Existing global env-var integrations (GSC,
-- DataForSEO, Anthropic, Gemini) are untouched and keep working exactly
-- as before -- this table has no relationship to them.
--
-- Secrets are encrypted at the APPLICATION layer (lib/crypto.ts, AES-256-GCM)
-- before ever reaching this table, so no Postgres extension (e.g. pgcrypto)
-- is required here. credentials_encrypted is opaque ciphertext to Postgres.
-- ============================================================

create table if not exists brand_integrations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,

  -- Free-text, not a Postgres enum -- keeps this table open to "future
  -- providers" per the sprint goal without a migration to add each one.
  -- lib/integrations.ts's IntegrationProvider union is the source of truth
  -- for which providers the application currently understands.
  provider text not null,

  -- disconnected | connected | error | expired -- see IntegrationStatus in
  -- lib/integrations.ts. Plain text, same convention as jobs.status /
  -- runs.status elsewhere in this schema (no CHECK constraint; enforced in
  -- the TypeScript layer).
  status text not null default 'disconnected',

  -- Opaque ciphertext (iv:authTag:ciphertext, base64 segments) produced by
  -- lib/crypto.ts. Never written or read anywhere except
  -- lib/integrations.ts's upsertIntegrationCredentials()/
  -- getDecryptedCredentials(). Nullable: a row can exist in 'disconnected'
  -- status before any credential has ever been set.
  credentials_encrypted text,

  -- Non-secret, provider-specific config (e.g. a GA4 property id or a
  -- HighLevel location id) that's useful to read/display without touching
  -- the encrypted blob at all.
  metadata jsonb not null default '{}'::jsonb,

  last_connected_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (brand_id, provider)
);

create index if not exists brand_integrations_brand_idx
  on brand_integrations (brand_id);

create index if not exists brand_integrations_provider_idx
  on brand_integrations (provider);

alter table brand_integrations enable row level security;
-- No policies -- service-role only, same convention as jobs/profiles/
-- lessons/metric_snapshots/brand_locks. No anon/authenticated grant is
-- given, so this table is unreachable from the browser under any
-- circumstance, satisfying "no client-side access" by construction rather
-- than by policy logic that could be misconfigured later.

comment on table brand_integrations is
  'Per-brand third-party integration credentials (Sprint 6.1 foundation). Provider-agnostic: one row per (brand_id, provider). credentials_encrypted is application-layer AES-256-GCM ciphertext (lib/crypto.ts) -- never plaintext at rest, never read/written outside lib/integrations.ts. No provider is implemented yet; this table has no consumers besides the service layer until a future sprint adds one.';
comment on column brand_integrations.credentials_encrypted is
  'AES-256-GCM ciphertext, format iv_b64:authTag_b64:ciphertext_b64. Decrypt only via lib/integrations.ts:getDecryptedCredentials(). Requires INTEGRATION_ENCRYPTION_KEY.';
