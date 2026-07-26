-- Quote request leads captured by the public site's /api/lead endpoint.
-- `brand` lets the same table serve Junk Free and POMO BUILD later.
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  brand text not null default 'junkfree',
  name text not null,
  phone text,
  email text,
  city text,
  details text,
  source_page text,
  casl_consent boolean not null default false,
  consented_at timestamptz,
  status text not null default 'new', -- new | contacted | quoted | won | lost
  created_at timestamptz not null default now()
);
create index if not exists leads_brand_created_idx on leads (brand, created_at desc);
