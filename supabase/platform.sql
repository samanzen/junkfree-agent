-- ============================================================
-- MULTI-TENANT SEO PLATFORM SCHEMA
-- Each brand/customer is a row. One engine serves them all.
-- This is what makes the system sellable to Volo Locals customers.
-- ============================================================

-- Every business the platform runs SEO for (Junk Free, POMO BUILD, or a
-- Volo Locals customer). The brand config lives here instead of in code.
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                    -- 'junkfree', 'pomobuild'
  name text not null,
  site_url text not null,
  gsc_property text,                            -- 'sc-domain:junkfree.ca'
  gbp_location_id text,                         -- Google Business Profile location
  service_area text,
  services text,
  edge text,                                    -- differentiators
  voice text,                                   -- brand tone for the writer
  competitors text,                             -- comma-separated domains
  intent_notes text,                            -- e.g. "we are NOT free; filter free-seekers"
  auto_publish_meta boolean not null default false,
  active boolean not null default true,
  owner_email text,                             -- who gets reports/alerts
  created_at timestamptz not null default now()
);

-- Add brand_id to the existing tables so every run/draft belongs to a brand.
alter table runs   add column if not exists brand_id uuid references brands(id) on delete cascade;
alter table drafts add column if not exists brand_id uuid references brands(id) on delete cascade;
alter table content add column if not exists brand_id uuid references brands(id) on delete cascade;

-- Local SEO: citations / backlink opportunities the agent surfaces.
create table if not exists citations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  name text not null,                           -- 'HomeStars', 'BBB', 'Yelp'
  url text,
  category text,                                -- directory | association | local_news | niche
  priority int default 0,                       -- higher = do first
  rationale text,
  status text not null default 'suggested',     -- suggested | in_progress | live | skipped
  created_at timestamptz not null default now()
);

-- Google Business Profile posts the agent drafts for the owner to publish.
create table if not exists gbp_posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  title text,
  body text not null,
  cta text,                                     -- 'Call now', 'Get quote'
  status text not null default 'pending_review',
  created_at timestamptz not null default now()
);

-- Review responses the agent drafts (responding to all reviews = ranking signal).
create table if not exists review_responses (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  reviewer_name text,
  rating int,
  review_text text,
  draft_response text not null,
  status text not null default 'pending_review',
  created_at timestamptz not null default now()
);

-- Weekly performance snapshots for the email report.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  period_start date,
  period_end date,
  summary text,                                 -- human-readable report body
  metrics jsonb,                                -- clicks, impressions, positions
  created_at timestamptz not null default now()
);

create index if not exists brands_active_idx on brands(active);
create index if not exists citations_brand_idx on citations(brand_id, priority desc);
create index if not exists gbp_posts_brand_idx on gbp_posts(brand_id, created_at desc);
create index if not exists review_resp_brand_idx on review_responses(brand_id, created_at desc);

-- Grant access to the service role (and legacy roles) for all new tables.
grant all privileges on table brands, citations, gbp_posts, review_responses, reports to service_role;
grant all privileges on table brands, citations, gbp_posts, review_responses, reports to anon, authenticated;

-- Seed the two local-service brands.
insert into brands (slug, name, site_url, gsc_property, service_area, services, edge, voice, intent_notes, owner_email)
values
  ('junkfree', 'Junk Free', 'https://www.junkfree.ca', 'sc-domain:junkfree.ca',
   'Greater Vancouver / Lower Mainland, BC',
   'Junk removal, demolition, waste management, hauling, cleanup, eco-friendly disposal',
   'Same/next-day service, eco-friendly disposal, residential & commercial',
   'Direct, trustworthy, local, no-nonsense. Canadian spelling.',
   'IMPORTANT: This is a PAID service. The word "free" in the brand name attracts free-seekers. On pages ranking for "free" terms, make pricing/paid nature clear early and qualify intent so free-seekers self-filter.',
   null),
  ('pomobuild', 'POMO BUILD', 'https://www.pomobuild.ca', 'sc-domain:pomobuild.ca',
   'Greater Vancouver / Lower Mainland, BC',
   'Renovation, landscaping, painting, construction',
   'Quality craftsmanship, licensed, local contractor, full-service renovations',
   'Professional, confident, quality-focused, local. Canadian spelling.',
   null, null)
on conflict (slug) do nothing;
