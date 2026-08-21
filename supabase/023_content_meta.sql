-- ============================================================
-- CONTENT META + UPDATED_AT (proxy public origin + sitemap)
--
-- Additive / idempotent. meta_description is filled by Approve/publish
-- from draft front matter. updated_at is preferred for sitemap lastmod.
-- ============================================================

alter table content
  add column if not exists meta_description text,
  add column if not exists updated_at timestamptz;

-- Backfill so lastmod is never null for already-published rows
update content
   set updated_at = published_at
 where updated_at is null
   and published_at is not null;

create index if not exists content_brand_published_idx
  on content (brand_id, published_at)
  where published_at is not null;

comment on column content.meta_description is
  'Meta description. Populated by Approve/publish from draft front matter.';
comment on column content.updated_at is
  'Last content modification. Preferred over published_at for sitemap lastmod.';
