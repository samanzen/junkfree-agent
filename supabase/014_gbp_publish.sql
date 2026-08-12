-- GBP / review publish bookkeeping (additive).
-- Apply when ready; code degrades if columns are missing.
--
-- gbp_posts.remote_name     — Google localPosts resource name after publish
-- gbp_posts.published_at    — when it went live on GBP
-- review_responses.google_review_name — accounts/.../reviews/... for reply API

alter table gbp_posts
  add column if not exists remote_name text,
  add column if not exists published_at timestamptz;

alter table review_responses
  add column if not exists google_review_name text,
  add column if not exists published_at timestamptz;
