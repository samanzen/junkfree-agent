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
2. Create a Supabase project, run `supabase/schema.sql` in its SQL editor.
3. Create a Google Cloud service account, enable the Search Console API, and add the service-account email as a user on the `junkfree.ca` property. Put its email + private key in the env.
4. Copy `.env.example` → `.env.local` and fill it in.
5. `npm run dev`, open `/dashboard`, click **Run agents now** to watch a full cycle.
6. Deploy to Vercel. The cron in `vercel.json` takes over automatically.

## Env

See `.env.example`. Key switches:
- `MAX_TASKS_PER_RUN` — work produced per run (default 4).
- `AUTO_PUBLISH` — `true` lets safe meta fixes go live without review.
- `CRON_SECRET` — protects the cron endpoint from being triggered by anyone else.

## What's not wired yet (next steps)

- **Google Ads API** — the console's Ads Advisor plans campaigns; pushing live bids needs OAuth into the Ads API and stays behind your approval by design.
- **Keyword volume data** — GSC gives your own performance; add DataForSEO or Ahrefs for market-wide volume/difficulty on brand-new keywords.
- **The rebuilt site** — this agent writes into a `content` table. The public Next.js site that renders those routes (preserving your 257 existing URLs) is the companion build. Paste the sitemap and it gets scaffolded next.
