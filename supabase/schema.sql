-- Run this in the Supabase SQL editor to set up the agent's memory.

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',      -- running | done | error
  tasks_planned int default 0,
  drafts_produced int default 0,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade,
  task_type text not null,                     -- fix_meta | improve_content | new_page | new_blog | technical_fix
  target_url text,
  target_keyword text,
  title text not null,
  body text not null,                          -- markdown or JSON payload
  rationale text,
  status text not null default 'pending_review', -- pending_review | approved | published | dismissed
  created_at timestamptz not null default now()
);

-- Published content the rebuilt Next.js site reads from and renders.
create table if not exists content (
  slug text primary key,
  task_type text,
  title text,
  body text,
  published_at timestamptz
);

create index if not exists drafts_status_idx on drafts(status);
create index if not exists drafts_created_idx on drafts(created_at desc);
