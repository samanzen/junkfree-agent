-- ============================================================
-- AI VISIBILITY (GEO / AEO) INTELLIGENCE
--
-- Apply in the Supabase SQL editor. Forward-only, additive, idempotent.
-- Run the WHOLE file (Run, not a highlighted fragment). A previous partial
-- run that created ai_visibility_prompts without `weight` used to fail here
-- with 42703; the ADD COLUMN IF NOT EXISTS statements below heal that.
--
-- WHAT THIS REPLACES
-- Until now "AI visibility" was a single integer on metric_snapshots, written
-- by lib/metrics.ts from one call to checkAiVisibility(): ONE question ("best
-- <first service> in <first service area>"), asked of ONE model (Claude), and
-- reduced to 100 or 0 depending on whether the brand's name appeared. The
-- answer text -- which already contained the ranked list of businesses the
-- assistant recommended and the sources it cited -- was discarded.
--
-- These tables keep the whole observation instead: which assistant answered,
-- which prompt was asked, in which country / region / city / neighbourhood and
-- language, whether we were named, WHERE in the list we were named, every other
-- business named alongside us, and every URL the assistant cited (flagging the
-- ones that are ours). That is what makes "improve our AI visibility" an
-- actionable loop rather than a number that moves for unknown reasons.
--
-- DESIGN RULES FOLLOWED HERE
--  * Nothing is inferred at write time that changes as the world changes.
--    Share of voice and mention rate are computed at READ time from these rows,
--    not frozen into a column that silently ages.
--  * The raw answer is kept. Every derived field can be re-derived from it, so
--    a parser improvement can be applied retroactively.
--  * Every table is brand-scoped with ON DELETE CASCADE, RLS enabled and no
--    anon/authenticated policies -- reads happen server-side through the
--    service-role client, exactly like page_audits and publish_executions.
--  * Application code degrades gracefully if this file has NOT been applied:
--    lib/ai-visibility/store.ts treats "table not found" as "feature not
--    migrated" and the API reports available:false with a reason, the same
--    convention app/api/portal/technical uses.
-- ============================================================


-- ── 1. Locales: where (and in which language) the brand is asked about ──────
--
-- A brand's service_area is free text ("Calgary / Airdrie / Okotoks"), which is
-- enough to generate prompts from but not enough to REPORT on -- you cannot
-- group by city if the city was never stored as a city. This table is the
-- structured form: one row per place-and-language combination we check.
--
-- `source` records where the row came from. 'parsed' rows are derived from
-- brands.service_area by lib/ai-visibility/locales.ts and are refreshed on
-- every run, so editing the brand's service area updates them. 'explicit' rows
-- were entered deliberately (an admin adding a neighbourhood, or a second
-- language for the same city) and are NEVER overwritten by parsing.
create table if not exists ai_visibility_locales (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,

  -- Place, coarse to fine. Only `label` is required: a national brand may have
  -- no city, and most brands have no neighbourhood. Storing them as separate
  -- columns (rather than one string) is what allows "how do we do in Calgary
  -- overall" to be answered across its neighbourhoods.
  country text,                       -- 'Canada', 'United States'
  country_code text,                  -- ISO-3166-1 alpha-2, 'CA', 'US'
  region text,                        -- province / state, 'Alberta'
  city text,                          -- 'Calgary'
  neighborhood text,                  -- 'Beltline', 'Kensington'

  -- The place as it should appear inside a prompt. Held explicitly rather than
  -- assembled at read time so the exact wording that produced a result stays
  -- reproducible even if the assembly rules change later.
  label text not null,

  -- BCP-47-ish language tag the prompt is written in. A bilingual city is two
  -- rows (Montreal/en and Montreal/fr), because the assistant answers
  -- differently in each and the whole point is to see that difference.
  language text not null default 'en',

  -- Optional bridge to the existing DataForSEO integration, used by the
  -- AI Overviews provider so a SERP lookup is geo-targeted the same way the
  -- rest of the platform's SERP calls already are (see lib/dataforseo.ts Geo).
  dataforseo_location_code int,

  source text not null default 'parsed',   -- parsed | explicit
  active boolean not null default true,
  created_at timestamptz not null default now(),

  -- One row per place+language per brand. This is what makes the parsed-row
  -- refresh an upsert instead of an ever-growing pile of duplicates.
  unique (brand_id, label, language)
);

alter table ai_visibility_locales
  add column if not exists country text,
  add column if not exists country_code text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists neighborhood text,
  add column if not exists label text,
  add column if not exists language text not null default 'en',
  add column if not exists dataforseo_location_code int,
  add column if not exists source text not null default 'parsed',
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

create index if not exists ai_visibility_locales_brand_idx
  on ai_visibility_locales (brand_id, active);


-- ── 2. Prompts: the questions a real person would ask an assistant ──────────
--
-- A prompt is (intent template x service x locale x language). `prompt_key` is
-- a deterministic hash-free identifier built from those inputs, so the SAME
-- question keeps the SAME row across runs and its history is comparable. Change
-- the wording of a template and you get a new key -- deliberately, because
-- results either side of a wording change are not the same measurement.
create table if not exists ai_visibility_prompts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,

  prompt_key text not null,           -- stable id, e.g. 'discovery|junk removal|calgary|en'
  intent text not null,               -- discovery | recommendation | proximity | comparison |
                                      -- price | trust | problem | brand | alternative
  template_id text not null,          -- which template produced it
  service text,                       -- the service segment used, when any
  locale_id uuid references ai_visibility_locales(id) on delete set null,
  language text not null default 'en',

  -- The literal text sent to the assistant. Kept so a report can show the
  -- customer the exact question, in their own language, that they lost.
  text text not null,

  -- Higher runs first when a cap trims the set. Brand-intent and
  -- high-commercial-intent prompts matter more than long-tail curiosities.
  weight int not null default 100,

  active boolean not null default true,
  created_at timestamptz not null default now(),

  unique (brand_id, prompt_key)
);

-- CREATE TABLE IF NOT EXISTS does not add columns to a table that already
-- exists. A half-applied run left this table standing without `weight`, and
-- the index below then raised 42703. Adding the column is a no-op when the
-- table was created from this file in full.
alter table ai_visibility_prompts
  add column if not exists prompt_key text,
  add column if not exists intent text,
  add column if not exists template_id text,
  add column if not exists service text,
  add column if not exists locale_id uuid references ai_visibility_locales(id) on delete set null,
  add column if not exists language text not null default 'en',
  add column if not exists text text,
  add column if not exists weight int not null default 100,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

drop index if exists ai_visibility_prompts_brand_idx;
create index if not exists ai_visibility_prompts_brand_idx
  on ai_visibility_prompts (brand_id, active, weight desc);


-- ── 3. Runs: one sweep of prompts x assistants ──────────────────────────────
--
-- The unit a trend line is drawn from. A run may be processed across several
-- queue jobs (each job stays under the platform's 60s function budget), so it
-- is opened by the first job and finalised by the last.
create table if not exists ai_visibility_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,

  status text not null default 'running',   -- running | done | error
  assistants jsonb not null default '[]'::jsonb,  -- ids actually attempted
  prompts_planned int not null default 0,
  checks_completed int not null default 0,
  checks_failed int not null default 0,

  -- Mention rate for the run, 0-100, computed when the run is finalised. Stored
  -- because it is the trend series -- recomputing it across every historical
  -- check on every page load would be wasteful, and a finalised run's inputs
  -- never change.
  mention_rate numeric(5,2),

  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table ai_visibility_runs
  add column if not exists status text not null default 'running',
  add column if not exists assistants jsonb not null default '[]'::jsonb,
  add column if not exists prompts_planned int not null default 0,
  add column if not exists checks_completed int not null default 0,
  add column if not exists checks_failed int not null default 0,
  add column if not exists mention_rate numeric(5,2),
  add column if not exists error text,
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists finished_at timestamptz;

create index if not exists ai_visibility_runs_brand_time_idx
  on ai_visibility_runs (brand_id, started_at desc);


-- ── 4. Checks: one prompt asked of one assistant, once ──────────────────────
create table if not exists ai_visibility_checks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  run_id uuid references ai_visibility_runs(id) on delete cascade,
  prompt_id uuid references ai_visibility_prompts(id) on delete set null,

  -- Denormalised copies of the prompt's identity. Deliberate: a check is an
  -- historical fact and must stay readable even if the prompt row is later
  -- deactivated or the locale is deleted.
  prompt_key text not null,
  prompt_text text not null,
  intent text,
  language text not null default 'en',
  country text,
  region text,
  city text,
  neighborhood text,
  locale_label text,

  -- Which assistant answered, and with which model. Both matter: "we are
  -- invisible on Gemini but strong on ChatGPT" is the finding.
  assistant text not null,            -- claude | gemini | openai | perplexity | ai_overview
  model text,

  -- The observation.
  mentioned boolean not null default false,
  rank int,                           -- 1-based position among businesses named; null when absent
  brands_named jsonb not null default '[]'::jsonb,  -- ordered list of every business named
  sentiment text,                     -- positive | neutral | negative | null (only when mentioned)

  -- Our named count over the total number of businesses named, 0-100. Stored
  -- per check because it is a property of THIS answer and cannot change.
  share_of_voice numeric(5,2),

  -- The full answer. Every derived column above can be recomputed from this,
  -- which is what makes a parser improvement applicable to history.
  answer_text text,

  -- Operational detail, so a quiet degradation is visible rather than looking
  -- like a genuine drop in visibility.
  latency_ms int,
  error text,

  checked_at timestamptz not null default now()
);

alter table ai_visibility_checks
  add column if not exists run_id uuid references ai_visibility_runs(id) on delete cascade,
  add column if not exists prompt_id uuid references ai_visibility_prompts(id) on delete set null,
  add column if not exists prompt_key text,
  add column if not exists prompt_text text,
  add column if not exists intent text,
  add column if not exists language text not null default 'en',
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists neighborhood text,
  add column if not exists locale_label text,
  add column if not exists assistant text,
  add column if not exists model text,
  add column if not exists mentioned boolean not null default false,
  add column if not exists rank int,
  add column if not exists brands_named jsonb not null default '[]'::jsonb,
  add column if not exists sentiment text,
  add column if not exists share_of_voice numeric(5,2),
  add column if not exists answer_text text,
  add column if not exists latency_ms int,
  add column if not exists error text,
  add column if not exists checked_at timestamptz not null default now();

-- The report's hot path: newest first for a brand.
create index if not exists ai_visibility_checks_brand_time_idx
  on ai_visibility_checks (brand_id, checked_at desc);

-- Per-run reads when finalising and when rendering one sweep.
create index if not exists ai_visibility_checks_run_idx
  on ai_visibility_checks (run_id);

-- "How has this exact question trended, on this assistant" -- the per-prompt
-- history view.
create index if not exists ai_visibility_checks_prompt_history_idx
  on ai_visibility_checks (brand_id, prompt_key, assistant, checked_at desc);

-- Failure triage without scanning the table.
create index if not exists ai_visibility_checks_errors_idx
  on ai_visibility_checks (brand_id, checked_at desc)
  where error is not null;


-- ── 5. Citations: the URLs an assistant leaned on ───────────────────────────
--
-- This is the table that answers "what page of ours got us recommended". One
-- row per cited URL per check; `is_own` is set by the writer after normalising
-- the host against the brand's own domain.
create table if not exists ai_visibility_citations (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references ai_visibility_checks(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,

  url text not null,
  domain text,
  title text,
  position int,                       -- order the assistant listed its sources in
  is_own boolean not null default false,

  created_at timestamptz not null default now()
);

alter table ai_visibility_citations
  add column if not exists url text,
  add column if not exists domain text,
  add column if not exists title text,
  add column if not exists position int,
  add column if not exists is_own boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

-- "Which of our pages earn AI citations" -- the cited-pages leaderboard.
create index if not exists ai_visibility_citations_own_idx
  on ai_visibility_citations (brand_id, is_own, created_at desc);

create index if not exists ai_visibility_citations_check_idx
  on ai_visibility_citations (check_id);

-- Domain-level rollup ("who gets cited instead of us") without a table scan.
create index if not exists ai_visibility_citations_domain_idx
  on ai_visibility_citations (brand_id, domain, created_at desc);


-- ── 6. Access control ───────────────────────────────────────────────────────
-- Same posture as page_audits / publish_executions / brand_integrations: RLS on,
-- no anon/authenticated policies, service_role only. Both the revoke and the
-- grant are stated explicitly so this cannot repeat the missing-grant defect
-- that 006_brand_integrations.sql shipped with and 011 had to fix.
alter table ai_visibility_locales   enable row level security;
alter table ai_visibility_prompts   enable row level security;
alter table ai_visibility_runs      enable row level security;
alter table ai_visibility_checks    enable row level security;
alter table ai_visibility_citations enable row level security;

revoke all on table
  ai_visibility_locales, ai_visibility_prompts, ai_visibility_runs,
  ai_visibility_checks, ai_visibility_citations
  from anon, authenticated;

grant all privileges on table
  ai_visibility_locales, ai_visibility_prompts, ai_visibility_runs,
  ai_visibility_checks, ai_visibility_citations
  to service_role;


-- ── 7. Documentation in the database itself ─────────────────────────────────
comment on table ai_visibility_locales is
  'Structured places (country/region/city/neighbourhood) and languages a brand is asked about by AI assistants. source=parsed rows are refreshed from brands.service_area on every run; source=explicit rows are admin-entered and never overwritten.';
comment on table ai_visibility_prompts is
  'The questions asked of AI assistants: intent template x service x locale x language. prompt_key is stable across runs so one question has a comparable history.';
comment on table ai_visibility_runs is
  'One sweep of prompts x assistants for a brand. mention_rate is frozen at finalisation because a completed run''s inputs never change; every other aggregate is computed at read time.';
comment on table ai_visibility_checks is
  'One prompt asked of one assistant, once. answer_text is retained so every derived column (mentioned/rank/brands_named/sentiment) can be re-derived if the parser improves.';
comment on table ai_visibility_citations is
  'Every URL an assistant cited in an answer, with is_own set when the host matches the brand''s own domain. This is what identifies which of the brand''s pages earn AI citations.';
comment on column ai_visibility_checks.share_of_voice is
  'Our mentions over the total number of businesses named in THIS answer, 0-100. Per-check because it is a property of one answer and cannot change afterwards.';
comment on column ai_visibility_checks.rank is
  '1-based position of the brand among the businesses the assistant named, in the order it named them. Null when the brand was not mentioned at all.';
