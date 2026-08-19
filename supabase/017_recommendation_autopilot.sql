-- ============================================================
-- PER-SECTION AUTOPILOT FOR AI RECOMMENDATIONS
--
-- Apply in Supabase SQL editor (forward-only, idempotent).
-- Shape of recommendation_autopilot jsonb:
--   {
--     "content": false,
--     "pages": false,
--     "meta": false,
--     "google_posts": false,
--     "backlinks": false
--   }
-- Each AI Recommendations tab can be Approval (false) or Autopilot (true).
-- Legacy brands.auto_publish_meta still exists and is kept in sync for Meta.
-- ============================================================

alter table brands
  add column if not exists recommendation_autopilot jsonb not null default '{}'::jsonb;

comment on column brands.recommendation_autopilot is
  'Per AI Recommendations tab autopilot flags (content/pages/meta/google_posts/backlinks). false = human approval required.';

-- Seed meta from legacy auto_publish_meta so behaviour does not jump on deploy.
update brands
set recommendation_autopilot =
  coalesce(recommendation_autopilot, '{}'::jsonb)
  || jsonb_build_object('meta', auto_publish_meta)
where recommendation_autopilot = '{}'::jsonb
   or not (recommendation_autopilot ? 'meta');
