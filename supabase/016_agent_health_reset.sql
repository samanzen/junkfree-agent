-- ============================================================
-- AGENT HEALTH RESET (OPTIONAL OPS SCRIPT)
--
-- NOT auto-applied. Paste into the Supabase SQL editor for ONE brand
-- after reviewing the SELECTs. Replace :brand_id with the real UUID.
--
-- What this does:
--   1) Deactivates social/directory "competitors" (Facebook, Yelp, …)
--   2) Dismisses stale pending_review drafts so agents can plan fresh work
--   3) Fails stuck queued/running jobs so the pipeline can seed again
--
-- What this does NOT touch: brands, integrations, GSC, publish credentials,
-- published content, keyword history.
-- ============================================================

-- Preview brand ids:
--   select id, name, slug from brands order by name;

-- 1) Preview bad competitors
select id, domain, name, active
from competitors
where brand_id = ':brand_id'
  and active = true
  and domain ~* '(facebook|fb\\.com|instagram|reddit|youtube|youtu\\.be|tiktok|pinterest|linkedin|nextdoor|yelp|tripadvisor|homestars|yellowpages|bbb\\.org|angi\\.com|thumbtack|houzz|craigslist|quora|medium|wikipedia|maps\\.google|google\\.com|bing\\.com)';

-- Deactivate them (prefer soft-disable over delete)
update competitors
set active = false
where brand_id = ':brand_id'
  and active = true
  and domain ~* '(facebook|fb\\.com|instagram|reddit|youtube|youtu\\.be|tiktok|pinterest|linkedin|nextdoor|yelp|tripadvisor|homestars|yellowpages|bbb\\.org|angi\\.com|thumbtack|houzz|craigslist|quora|medium|wikipedia|maps\\.google|google\\.com|bing\\.com)';

-- 2) Preview stale open drafts
select id, task_type, title, target_keyword, status, created_at
from drafts
where brand_id = ':brand_id'
  and status = 'pending_review'
order by created_at;

-- Dismiss all pending drafts so the next "Run agents now" can plan cleanly.
-- Comment this out if you want to keep some rows and dismiss them in the UI instead.
update drafts
set status = 'dismissed'
where brand_id = ':brand_id'
  and status = 'pending_review';

-- 3) Unblock the job queue
select id, kind, status, created_at, error
from jobs
where brand_id = ':brand_id'
  and status in ('queued', 'running')
order by created_at;

update jobs
set status = 'failed',
    error = coalesce(error, '') || ' | manual reset: clear backlog for agent health',
    finished_at = now()
where brand_id = ':brand_id'
  and status in ('queued', 'running');

-- After this: open /dashboard → Run agents now, then trigger Intelligence
-- refresh via cron rank-sync / rank-enrich (or wait for the scheduled runs).
