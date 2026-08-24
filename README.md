# Junk Free — Autonomous SEO Agent

A self-driving SEO system. On a schedule it reads the site's real Google Search Console performance, decides the highest-value work, runs specialist agents to produce it, and queues the results for you to approve (or auto-publishes the safe ones).

Swap `lib/brand.ts` and the same engine runs POMO BUILD or Volo Locals.

## The loop

1. **Trigger** — Vercel cron hits `/api/cron/orchestrate` daily.
2. **Gather signals** — `lib/gsc.ts` pulls striking-distance keywords (ranking 5–20) and low-CTR pages.
3. **Decide** — `lib/orchestrator.ts` asks Claude to turn those signals into a ranked task list.
4. **Execute** — specialist agents in `lib/agents/` write pages/blogs, rewrite meta, and audit pages.
5. **Queue** — drafts land in Supabase with status `pending_review`.
6. **Review** — approve/publish at `/dashboard`, or let `AUTO_PUBLISH=true` clear the low-risk meta fixes.

## Why the human gate matters

Auto-publishing unreviewed AI pages at volume is a real ranking risk (Google's spam policies target scaled content abuse). By default only `fix_meta` tasks can auto-publish; new pages and blogs wait for your approval. `MAX_TASKS_PER_RUN` caps how much it produces per run so the site grows at a natural pace.

## Setup

1. `npm install`
2. Create a Supabase project, then run every file in `supabase/` in its SQL editor, in this order: `schema.sql`, `platform.sql`, `leads.sql`, `sprint4_migration.sql`, `004_reconcile_prod_schema.sql`, `005_execution_engine.sql`, `006_brand_integrations.sql`, `007_business_model.sql`, `008_content_tenant_isolation.sql`, `009_brand_locks_service_role_grant.sql`, `010_page_audits.sql`, `011_publish_executions.sql`, `012_rate_limits.sql`, `013_agentic_seo_team.sql`, `014_feature01_hardening.sql`, `016_agent_health_reset.sql`, `017_recommendation_autopilot.sql`, `018_ai_visibility.sql`, `019_owner_company.sql`, `020_execution_honesty.sql`, `021_source_of_truth.sql`, `022_proxy_publishing.sql`, `023_content_meta.sql`. All are additive/idempotent, so re-running an already-applied file is safe. `platform.sql` seeds the two bootstrap brands (Junk Free, POMO BUILD) — this is the only brand-seeding done via SQL; see "Adding a new brand" below for every brand after those two.
3. Create a Google Cloud service account, enable the Search Console API, and add the service-account email as a user on the `junkfree.ca` property. Put its email + private key in the env.
4. Copy `.env.example` → `.env.local` and fill it in.
5. `npm run dev`, open `/dashboard`, click **Run agents now** to watch a full cycle.
6. Deploy to Vercel. The cron in `vercel.json` takes over automatically.
7. `npm test` runs the unit test suite (currently `lib/crypto.test.ts`).

## Adding a new brand (Sprint 6.3)

Every brand after the two SQL-seeded bootstrap brands is added through the app, not the SQL editor:

1. Create the customer's Supabase Auth user via the Supabase dashboard (Authentication → Users → Add user). This step is still manual by design — onboarding does not create auth accounts or send invite emails.
2. Have that person sign in once at `/login`. This is what creates their `profiles` row (`lib/auth.ts`'s `requireAuth()` does this lazily on first sign-in) — there is no other way for a `profiles` row to be created.
3. As an admin, open `/dashboard` → the **Brands** tab. Create the brand there (name, slug, site URL, business model, optional GSC property), then use that brand's **Link user** action to assign the email from step 1 to it and set their role.

## AI visibility (GEO/AEO)

People increasingly ask an assistant for a recommendation instead of scrolling a
results page. `lib/ai-visibility/` measures whether the brand is the answer.

A weekly sweep (`/api/cron/ai-visibility`, Tuesdays) asks the questions a real
customer would ask and records what came back:

- **which assistant** answered — Claude, Gemini, ChatGPT, Perplexity, or Google's
  AI Overview read off a live SERP through DataForSEO
- **which question** — nine intent shapes (discovery, recommendation, problem,
  trust, comparison, proximity, price, brand, alternative) crossed with each of
  the brand's services
- **where** — country, region, city and neighbourhood, parsed out of the brand's
  free-text service area into structured places
- **in which language** — the brand's own, plus optionally the other official
  languages of its country (`AI_VISIBILITY_MULTILINGUAL=1`)
- **whether we were named**, and at **what position** in the list
- **who else was named**, so competitor share of voice is measured rather than
  guessed
- **which URLs the assistant cited**, flagging ours — this is what identifies the
  pages actually earning the recommendation
- **how we were described** — positive, neutral or negative, from the sentences
  naming us

The loop closes in `lib/ai-visibility/analyst.ts`: after each sweep it writes
`lessons` rows (which `activeLessons()` feeds into the next planning run) and
queues answer-optimised content for the specific questions we lost. So a gap
found on Tuesday becomes a draft, not just a red number.

Setup:

1. Run `supabase/018_ai_visibility.sql` in the SQL editor. Run the **whole
   file** (click Run with nothing highlighted). A previous partial apply that
   created `ai_visibility_prompts` without `weight` used to fail with
   `42703: column "weight" does not exist`; re-running the current file heals
   that and creates the remaining tables. Until it succeeds, the sweep skips
   with `not_migrated` and `GET /api/intelligence/ai-visibility` reports
   `available: false`.
2. Configure at least one assistant. `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` and
   the DataForSEO credentials are probably already set, which gets you three.
   `OPENAI_API_KEY` and `PERPLEXITY_API_KEY` add the other two.
3. Optionally tune the caps in `.env.example` under "AI visibility".

Two things worth knowing before you read the numbers. These answers are
**non-deterministic** — ask the same model the same question twice and the list
changes — so the signal is a rate across many prompts and repeated sweeps, never
a single reading; the UI should always say "named in 6 of 12 questions" rather
than implying a precise score. And every check is a **web-search-grounded model
call**, the most expensive call the platform makes, which is why this has its own
weekly cadence and its own caps rather than riding the daily pipeline.

`metric_snapshots.ai_visibility` now holds the mention rate from the latest
completed sweep. It previously held 100 or 0 from a single yes/no question asked
of a single model, which made a percentage-suffixed KPI card out of a coin flip.

The full report is **Intelligence → AI visibility** on both the admin dashboard
and the customer portal. It is read-only: every figure is "named in 6 of 12
questions", never a lone percentage pretending at precision. Admins can trigger
a one-brand sweep from that page (`POST /api/cron/ai-visibility`); customers
wait for the weekly cron. The report covers assistants, questions, places,
languages, competitors, cited pages and the questions nobody named you for.

## Website connection

Connections → **Website connection** is Volo’s overall ability to work with a
customer’s site. One connection, many capabilities, different adapters
underneath (WordPress, Shopify, custom-coded receiver, **Volo Managed Pages**).

1. Run migrations `020`–`024` (`execution_honesty`, `source_of_truth`,
   `proxy_publishing`, `content_meta`, `proxy_nav_nudge`).
2. Set `INTEGRATION_ENCRYPTION_KEY` (see `.env.example`) for WP/Shopify/webhook.
3. In Portal → Settings → Connections, connect the site.
4. Confirm **where new pages are saved** (Source of Truth) when needed. For
   Managed Pages, SoT is `platform_proxy` (default managed path `/guides/`).
5. Click **Prove connection** — temporary canary page, live verify, delete.
6. Approve a draft — live publish only marks published after proof.

**Volo Managed Pages** (internal adapter id `proxy`): pages are stored in
`content` and served at `/s/{proxy_site_token}/{namespace}/{slug}` on this app.
Customer CDN rewrite must keep the namespace in the destination, e.g. Vercel:

```json
{ "rewrites": [{
  "source": "/guides/:path*",
  "destination": "https://YOUR_APP/s/site_TOKEN/guides/:path*"
}]}
```

Canonicals use the customer host (`X-Forwarded-Host`, validated against
`brands.site_url`). Sitemap: `/{namespace}/sitemap.xml`. Path selection is
Advanced-only; primary onboarding defaults to `/guides/`.

Coded-site API receiver remains a developer escape hatch. GitHub/custom-code
editing uses analyze → propose → approval → PR (not automatic production edits).

Title/meta-only updates on existing CMS pages still need WordPress/Shopify.

## Env

See `.env.example`. Key switches:
- `MAX_TASKS_PER_RUN` — work produced per run (default 4).
- `AUTO_PUBLISH` — `true` lets safe meta fixes go live without review.
- `CRON_SECRET` — protects the cron endpoint from being triggered by anyone else.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser Supabase client for login and every authenticated dashboard/portal API call (`lib/authedFetch.ts`).
- `INTEGRATION_ENCRYPTION_KEY` — AES-256-GCM key for encrypting per-brand third-party integration credentials (`lib/crypto.ts`). Only required once a provider integration is wired up; generate with `openssl rand -base64 32`.

## Multi-tenant auth (Sprint 6.1)

Every `/api/*` route (except the `CRON_SECRET`-gated cron endpoints) now requires a valid Supabase session, validated server-side via `lib/auth.ts`'s `requireAuth()`. Any route scoped to a single brand additionally calls `requireBrandAccess()`: admins may access any brand, customers only their own (`profiles.brand_id`). The job queue and execution engine (`lib/queue.ts`, `lib/runner.ts`) are brand-scoped end to end — `/api/run` and `/api/step` take a `brand_id` and only ever seed/drain that brand's queue, so one tenant's browser session can never see or advance another tenant's jobs.

`lib/integrations.ts` + `brand_integrations` (migration `006`) lay the foundation for per-brand third-party integrations (GA4, HighLevel, Stripe, QuickBooks, Jobber): credentials are AES-256-GCM encrypted at the application layer before they ever reach Postgres, and the table has RLS enabled with no policies (service-role only, unreachable from the browser). No provider is implemented yet — this is shared plumbing for a future sprint.

## What's not wired yet (next steps)

- **Google Ads API** — the console's Ads Advisor plans campaigns; pushing live bids needs OAuth into the Ads API and stays behind your approval by design.
- **Keyword volume data** — GSC gives your own performance; add DataForSEO or Ahrefs for market-wide volume/difficulty on brand-new keywords.
- **Title/meta live publish on WP/Shopify** — page upserts are certified; Yoast/RankMath (or Shopify SEO fields) for `update_meta` is still open.
- **The rebuilt public site companion** — coded-site brands still need their own Next app (or the Junk Free receiver example) deployed so `/api/seo-publish` is live.
