-- ============================================================
-- SPRINT 6.9 PHASE 1: CONTENT TENANT ISOLATION
-- Fixes a cross-tenant data-corruption bug: `content.slug` has been the
-- table's sole primary key since schema.sql, even after platform.sql added
-- `brand_id` as a plain column. slug is therefore globally unique across
-- EVERY brand, not per-brand unique -- if two different tenants' content
-- pipelines ever produce the same slug, the second brand's publish
-- (lib/steps.ts, app/api/drafts/[id]/approve, app/api/drafts/[id]/publish)
-- silently overwrites the first brand's row. This migration replaces the
-- primary key with a synthetic `id` and adds `unique (brand_id, slug)`, so
-- slug is only required to be unique WITHIN one brand.
--
-- UNLIKE every prior migration in this project (004-007), this is NOT
-- purely additive -- it changes an existing table's primary key. Before
-- applying this to a live database:
--   1. Back up/export the `content` table (Supabase dashboard -> Table
--      Editor -> content -> Export, or `pg_dump -t content`).
--   2. Run the Sprint 6.9 diagnostic query (three SELECTs checking for
--      null brand_id rows, cross-brand slug collisions, and the table's
--      current constraints) to see whether this migration can succeed
--      cleanly before running it.
--
-- SELF-GUARDING: if `content` already has any row with a null brand_id, or
-- any slug shared across more than one brand_id, this migration ABORTS
-- with a clear exception instead of guessing how to fix the data --
-- deciding which of two colliding rows is "correct" is a human judgment
-- call, not something safe to automate. Nothing is changed if it aborts.
--
-- IDEMPOTENT: safe to run again after it has already succeeded (detects
-- that `id` is already the primary key and does nothing), and safe to
-- run again after an abort once the flagged data has been fixed.
-- ============================================================

do $$
declare
  pk_is_id boolean;
  pk_is_slug boolean;
  unique_exists boolean;
  null_brand_count int;
  collision_count int;
begin
  -- Already applied? Nothing to do.
  select exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.table_name = 'content'
      and tc.constraint_type = 'PRIMARY KEY'
      and kcu.column_name = 'id'
  ) into pk_is_id;

  if pk_is_id then
    raise notice 'Sprint 6.9: content already uses id as primary key -- migration already applied, nothing to do.';
    return;
  end if;

  -- Guard 1: every row must already have a brand_id. Known cause: prior to
  -- Phase 2's fix, app/api/drafts/[id]/publish/route.ts never set brand_id
  -- on the rows it wrote.
  select count(*) into null_brand_count from content where brand_id is null;
  if null_brand_count > 0 then
    raise exception 'Sprint 6.9 migration aborted: % row(s) in content have a null brand_id. Assign the correct brand_id to each (a human decision -- inspect the flagged rows) before re-running this migration.', null_brand_count;
  end if;

  -- Guard 2: no slug may already be shared across more than one brand --
  -- i.e. the collision bug must not have already fired.
  select count(*) into collision_count from (
    select slug from content group by slug having count(distinct brand_id) > 1
  ) x;
  if collision_count > 0 then
    raise exception 'Sprint 6.9 migration aborted: % slug(s) in content are shared across more than one brand_id. Resolve each collision (rename one, delete an orphan, confirm which is correct) before re-running this migration.', collision_count;
  end if;

  -- Data is clean -- proceed with the actual schema change. DDL inside a
  -- PL/pgSQL block must go through EXECUTE.
  execute 'alter table content add column if not exists id uuid default gen_random_uuid()';
  execute 'update content set id = gen_random_uuid() where id is null';
  execute 'alter table content alter column id set not null';

  -- Only drop content_pkey if it's actually the primary key on slug -- if a
  -- constraint named content_pkey exists but isn't on slug (an unexpected
  -- state), leave it alone rather than blindly dropping whatever is there.
  select exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.table_name = 'content'
      and tc.constraint_type = 'PRIMARY KEY'
      and kcu.column_name = 'slug'
  ) into pk_is_slug;

  if pk_is_slug then
    execute 'alter table content drop constraint if exists content_pkey';
  end if;

  execute 'alter table content add constraint content_pkey primary key (id)';

  -- Only add the (brand_id, slug) unique constraint if it doesn't already exist.
  select exists (
    select 1 from pg_constraint
    where conrelid = 'content'::regclass
      and conname = 'content_brand_slug_unique'
  ) into unique_exists;

  if not unique_exists then
    execute 'alter table content add constraint content_brand_slug_unique unique (brand_id, slug)';
  end if;

  raise notice 'Sprint 6.9: content is now keyed by id, with a new unique (brand_id, slug) constraint. slug is no longer required to be globally unique across brands.';
end $$;

comment on column content.id is
  'Synthetic primary key (Sprint 6.9). Replaced the old slug-only primary key, which made slug globally unique across every tenant instead of per-brand -- see content_brand_slug_unique.';
comment on constraint content_brand_slug_unique on content is
  'Sprint 6.9: slug must be unique within one brand, not globally. Publish paths (lib/steps.ts, app/api/drafts/[id]/approve, app/api/drafts/[id]/publish) must upsert with onConflict: "brand_id,slug" against this constraint, not the old slug-only primary key.';
