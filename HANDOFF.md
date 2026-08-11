# PROJECT HANDOFF — junkfree-agent

**Prepared:** 11 Aug 2026
**Prepared by:** Claude Code (outgoing agent)
**For:** Cursor / any incoming senior engineering + design agent
**Status of this document:** Documentation only. No implementation was performed while writing it.

> **Read `START HERE FOR THE NEXT AGENT` at the bottom first if you only read one section.**

---

## 1. PRODUCT VISION

This is **not an SEO reporting dashboard**. Reporting is the visible surface; it is not the product.

The intended product is an **AI-powered SEO automation / operating platform**. A business connects its website and data sources, and AI agents then:

1. **Analyse** — crawl the site, read Search Console, track rankings, audit technical health, study competitors
2. **Recommend** — produce ranked, explained opportunities with rationale, not just metrics
3. **Generate** — write content, meta, GBP posts, review replies, citation targets
4. **Execute** — apply approved changes to the customer's *live* website
5. **Monitor** — re-measure, detect movement, surface failures
6. **Improve** — feed outcomes back into future decisions (`lib/learning.ts` exists)

The differentiator is **agency**: the platform is meant to *do the work*, not just display numbers. A human approves; the system executes.

**Audience.** Two distinct surfaces, deliberately separated:
- **Customers** (`/portal`) — business owners. Plain English, no agent jargon, no raw internals.
- **Operators/admins** (`/dashboard`) — the team running the platform across tenants.

**Target level of automation.** Today: scheduled agent runs produce drafts, a human approves, and approved work can be dispatched to a real site via adapters. The ambition is a genuinely autonomous SEO operating system where human approval becomes the exception rather than the gate.

---

## 2. CURRENT TECH STACK

Everything below was verified against the repository.

| Layer | Actual |
|---|---|
| Framework | **Next.js 15.5.22**, App Router |
| Runtime | React **18.3**, TypeScript **5.6** |
| Styling | **No Tailwind, no CSS modules, no shadcn.** Hand-authored CSS-in-TypeScript, injected via `<style>`; scoped per surface |
| Database | **Supabase** (Postgres). Service-role access server-side |
| Auth | Supabase Auth (email/password). Bearer token in `localStorage`, sent via `authedFetch` |
| AI | **Anthropic API**, `lib/anthropic.ts`. Model from `ANTHROPIC_MODEL`, default `claude-sonnet-5` |
| Charts | **Recharts 3.10** |
| Motion | **Framer Motion 12** (`LazyMotion` + `m`, not the full `motion` factory) |
| Fonts | **Inter only**, self-hosted via `next/font` |
| Testing | **Vitest 4.1** — 26 test files under `lib/` |
| Deployment | **Vercel** (`vercel.json` present) |
| Cron | Vercel Cron — 3 schedules (see below) |
| Queue | Custom Postgres-backed job queue (`lib/queue.ts`) |

**Cron schedules (`vercel.json`):**
- `/api/cron/orchestrate` — daily 09:00
- `/api/cron/rank-sync` — daily 06:00
- `/api/cron/rank-enrich` — weekly Mon 07:00

**External data:** DataForSEO (rankings), Google Search Console, Google OAuth.

**Environment keys** (names only, from `.env.example`): `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AUTO_PUBLISH`, `CRON_SECRET`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`, `INTEGRATION_ENCRYPTION_KEY`, `MANUAL_RUN_COOLDOWN_MINUTES`, `MAX_TASKS_PER_RUN`, `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.

---

## 3. REPOSITORY ARCHITECTURE

```
app/
  layout.tsx              Root layout. Inter via next/font, GLOBAL_CSS injection, NotifyProvider
  page.tsx                Redirects "/" → /dashboard
  login/                  Auth surface, own scoped CSS (.lg)
  portal/                 CUSTOMER surface, scope .portal
    layout.tsx            PortalAuthProvider + PortalShell
    PortalShell.tsx       Sidebar, topbar, drawer, bottom nav, theme toggle
    portalTheme.ts        ~1000-line design system for .portal (light + dark)
    _components/          Portal-only components
    _data.ts              Client data hooks
    <13 routes>/          Dashboard, Opportunities, Intelligence, Competitors, Local SEO,
                          Website, Technical SEO, Content, Reviews, Reports, Billing,
                          Settings, Assistant
  dashboard/              ADMIN surface, scope .sr
    page.tsx              815+ lines: markup + logic + inline CSS
    intelligence/         Intelligence tab (dynamically imported)
      palette.ts          Chart/status colours, derived from shared tokens
  _components/            SHARED across both surfaces (Field, Notify, ResponsiveTable)
  api/                    ~40 route handlers
lib/
  ui/tokens.ts            SHARED DESIGN FOUNDATION — read this first
  ui/*.test.ts            Design-system tests (contrast, tokens, structure)
  portalAuth.tsx          Portal auth/brand resolution
  queue.ts, runner.ts, steps.ts     Job queue + agent execution
  agentActivity.ts        Read-only agent activity (NEW, this session)
  execution/              Site-execution engine + adapters (wordpress, webhook)
  google/                 OAuth, token store, registry
  anthropic.ts            Claude API wrapper
supabase/                 SQL migrations 004–012 + schema files
```

### Architectural conventions that MUST be preserved

1. **Surface scoping.** `.portal` and `.sr` are isolated. Changing one must never affect the other. Do not merge them.
2. **Generator-function CSS.** `lib/ui/tokens.ts` exports `fieldCSS()`, `responsiveTableCSS()`, `touchTargetCSS()`, `semanticVars()` — each takes a scope and emits CSS for it. This is how consistency is achieved without one shared stylesheet. **Extend this pattern; do not bypass it.**
3. **Additive read-only data modules.** `runHealth.ts`, `scheduling.ts`, `agentActivity.ts` all follow: new read-only query, degrade to empty on error, never throw. Follow this for new reads.
4. **Portal speaks customer language.** No agent jargon, no internal IDs, no raw job kinds in `/portal`.
5. **Honest data.** The product distinguishes *real value* / *empty* / *locked/not connected*. Never blur these.

---

## 4. WHAT THE PLATFORM CAN DO TODAY

### Production / implemented
- **Multi-tenant brands** with admin CRUD, activation, user linking
- **Auth** — Supabase email/password, role-based routing (admin → `/dashboard`, customer → `/portal`)
- **Job queue** — `jobs` table, atomic claim, statuses `queued/running/done/failed`, brand-scoped
- **Agent run kinds** — `plan, content, geo, gbp, citations, audit, performance, rank_sync, rank_enrich, publish`
- **Cron orchestration** — 3 Vercel cron endpoints
- **Rankings** — DataForSEO sync + weekly enrichment
- **Search Console** — metrics, striking-distance keywords
- **AI generation** — content drafts, GBP posts, citations, review replies, exec summaries, recommendations
- **Approval workflow** — draft → approve → publish
- **Site execution** — approved drafts dispatched to live sites via **WordPress** and **generic webhook** adapters
- **Google OAuth** — connect flow, token storage, property selection
- **Portal (13 routes)** — all render
- **Admin dashboard** — Overview, Content, GBP, Citations, Intelligence, Brands
- **Intelligence** — keyword table, position distribution, winners/losers, competitors, AI recommendations, exec summary
- **AI Assistant** — chat endpoint + UI
- **Agent activity** *(new this session)* — `lib/agentActivity.ts` + `/api/portal/activity`, real job data with status, elapsed time, failure reasons
- **Rate limiting** — tenant-aware, on expensive routes
- **Notifications** — toast + confirm dialog system, replaced 24 `alert()` calls
- **Reports** — printable report view

### Partial
- **Local SEO** — citations exist; **no Google Business Profile integration** (score hardcoded `null`)
- **Technical SEO** — audits run; remediation is advisory only
- **Learning loop** — `lib/learning.ts` exists; influence on future runs unverified
- **Website page** — renders; depth unverified

### Mocked / placeholder
- **Billing** — no payment provider. All `ConnectCard` placeholders explaining what's missing
- **Leads / Calls / Conversions KPIs** — deliberately `locked`, honest "Connect to unlock"

### Planned / not implemented
- Global search / command palette (**P4**)
- Desktop header
- Shopify or other CMS adapters
- Self-serve plan management
- Real product name

---

## 5. WORK COMPLETED BEFORE THE CURRENT REDESIGN

### Pre-existing consolidation (before this session, evidenced in source comments)

A prior design-system consolidation had already collapsed:
- 23 radii → 5 · 36 shadows → 4 · 28 type sizes → 7 · 18 weights → 5
- 19 CSS durations + 16 Framer durations → 4 durations + 2 easings
- 5 ad-hoc breakpoints → 3 tokens (`sm 640 / md 900 / lg 1200`)
- 3 render-blocking font requests → 1 self-hosted family
- 24 `alert()` calls → toast system

### P1 — Contrast & correctness (this session)
**Problems found (measured, not estimated):**
- Primary CTA gradient: white on `#4DA3F5` = **2.67:1**
- Dark theme hardcoded `color:#fff` on a bright accent (~1.4:1)
- `.sr .ov-hint` `#B2BAC8` on white = **1.95:1**
- Six soft-badge pairs at 4.0–4.4:1
- `<body>` hardcoded `#0b0f14` — wrong-colour flash on every cold load
- `background-clip:text` on the largest heading

**Fixed:** all of the above. Gradients replaced by solid fills; `--on-accent` ink that flips per theme; body ground moved to `<html>` in `GLOBAL_CSS`.

### P2 — Token unification
- One semantic palette promoted to `lib/ui/tokens.ts`, consumed by all surfaces
- Portal `--r-*` bound to the shared `--radius-*` scale
- Numeric type role introduced (tabular figures)
- 58 size literals bound to `--fz-*`

### P3 — Motion & state
- `:active` press states added across portal/admin/login
- Four-level CTA hierarchy: primary / secondary / tertiary / **destructive legible at rest**
- Retired ambient loops: `pFloat`, `pBeacon`, hero aurora, ring halo, admin `scan`, per-card `rise`

### Accessibility work that must NOT be undone
- `:focus-visible` rings on every focusable element (via `touchTargetCSS()`)
- 44px touch floor scoped to `pointer:coarse` (desktop stays dense)
- 16px inputs (prevents iOS zoom)
- Skip link; focus trap with restore-to-trigger (`useDialog`)
- `aria-current`, `aria-expanded`, `role="dialog"`
- `<thead>` visually hidden but **kept in the a11y tree** in card-stack tables
- Errors carried by colour **and** text/icon — never colour alone
- Global `prefers-reduced-motion`
- Two toast live regions (assertive for errors/warnings, polite otherwise)

---

## 6. SIGNAL DESIGN SYSTEM (colour/data language — APPROVED)

**Core principle: colour encodes meaning. Encoding a data *dimension* IS meaning. Decoration is not.**

Four jobs, never mixed:

| Job | Light | Dark | Rule |
|---|---|---|---|
| **Brand** | `#2563EB` | `#5D9BFF` | Primary actions, active nav, focus. Also series slot 1 |
| **System / AI** | `#6D3BE4` | `#B98CF7` | **Only** agent runs, AI-written content, assistant, live status |
| **Positive** | `#0B7A42` | `#35C489` | Reserved status — never a chart series |
| **Attention** | `#8A6A00` | `#E0A038` | Reserved status |
| **Critical** | `#C2261F` | `#F0736A` | Reserved status |
| **Pink (data tone)** | `#AD2E86` | `#DE6B9C` | Data tone, not status |

**Categorical series (fixed order — do not re-sort):**
- Light: `#2563EB, #E8590C, #0E9384, #A67C00, #D6336C, #0284C7`
- Dark: `#3F84E8, #D95F28, #159C8B, #B0862A, #D14F86, #2891C4`

Gold sits between teal and magenta **because magenta adjacent to teal collides under deuteranopia (ΔE 1.2)**. The order is load-bearing.

**Validation performed:**
- All six checks of the dataviz validator pass in **both** modes (lightness band, chroma floor, CVD separation, normal-vision floor, contrast). Worst adjacent CVD ΔE **9.2 light / 11.3 dark**
- OKLab pair separation ≥ **0.10** enforced between status colours, and between status and both identities
- Every colour ≥ 4.5:1 as text on its surface; every `-soft` pair ≥ 4.5:1

**`-soft` tokens are OPAQUE, not rgba.** A translucent tint composites with whatever is behind it — the same chip measured 4.61:1 on `--surface` but 4.05:1 on `--surface3`. Opaque steps read identically everywhere.

### Rejected directions and why
| Rejected | Reason |
|---|---|
| Indigo/violet gradient (original) | Most-replicated look in the category; unownable. Also failed contrast |
| **Spruce-teal `#0B6E62`** | ΔE **0.051** from positive-green, 1.14:1 mutual contrast — a green delta and a teal link were nearly identical on dense tables |
| **Achromatic graphite brand** | Measured beautifully but produced a **monochrome** product. Stripping hue from metrics/charts destroyed scannability and read as editorial finance software |
| Rainbow / decorative colour | Colour must carry meaning |

**The rule this established:** *in a product where colour carries data meaning, the brand accent must be scored against the semantic palette, not just against its background.* Contrast is necessary and **not sufficient**. `lib/ui/instrument.test.ts` enforces this.

---

## 7. SIGNAL / OPERATOR DESIGN DIRECTION (form language — APPROVED)

**Signal** = the colour/data language. **Operator** = the form language: high-contrast, data-forward, built for someone running an operation.

### Why "Editorial Minimalism" was revised
It was briefly adopted, then rejected. The user's own exclusion list includes *luxury/editorial restaurant* and *monochrome editorial magazine* — an editorial treatment pushed directly toward those. Editorial calm is the wrong register for an agentic data product.

### Why Source Serif 4 was removed
- A serif display over dense data tables reads as a **publication**, not an instrument
- Products at the target quality bar (Linear, Vercel, Stripe, Figma, and Semrush's own app) use **sans in the product** and reserve serif for marketing
- The desired energy comes from **weight, scale and tracking**, not a second family
- It cost a second font download on the authenticated surface for a purely stylistic effect

**Serif may be reconsidered for the future marketing site. Not for the product.**
`lib/ui/tokens.test.ts` now **fails** if a serif reappears in `--font-display`.

### Typography
```
--font-display : var(--font-sans)         (Inter — same family, different register)
--fz-display   : clamp(38px, 5.4vw, 60px) hero
--fz-title     : clamp(28px, 3.2vw, 38px) page title
--fz-subhead   : 20px
--fw-display   : 750
--tr-display   : -.032em
--lh-display   : 1.02
```
KPI values **34px/700**. Hero stat figures **28px/700**. The old scale topped out at 33px, which is why nothing felt confident.

### Composition philosophy
- **One large data moment per screen.** On the dashboard that is the traffic chart (264 → **380px**, brand-blue area fill)
- **Data occupies area**, not just small chips
- **Placeholders are demoted, never equal.** Health scores went from 5 equal cards → **3 measured cards + one quiet dashed line** for unmeasured sources
- Panels are **hairline + space**, no shadow. Elevation reserved for things that genuinely float

### Motion
- **No entrance animation.** Content is present at first paint.
  Two reasons: (a) the dashboard read as *empty* for 2–3s; (b) Framer is `requestAnimationFrame`-driven and rAF is **paused in a background tab**, so anything gated on an entrance animation stays at `opacity:0` indefinitely if the page loads unfocused. Measured directly.
- Motion is reserved for **change**: number count-up, sparkline draw, agent row transitions, nav pill.

### Agentic visual language
Carried by **information**, not decoration: violet system hue, status dots (form + colour + word), monospace elapsed times, real job names, surfaced failure reasons.

### Why the dark agent territory was rejected
Evaluated in the rendered product and **declined**. Agent activity sits in the narrow right-hand column; a dark slab there would be heavy visual weight in a secondary position, fighting the light AI-briefing band directly above it. The agentic identity is already carried by information. A dark band would add contrast without adding meaning — decoration, which the brief excludes. *If* a dark territory ever belongs, it is a full-width agent/system **screen**, not a sidebar panel.

### Target feeling
INTELLIGENT · ENERGETIC · PREMIUM · MODERN · DATA-RICH · AGENTIC · CONFIDENT · MEMORABLE

### Must never become
generic AI SaaS · glassmorphism · neon cyberpunk · luxury/editorial restaurant · black-and-white finance software · template dashboard · rainbow UI · **Semrush clone**

**Semrush was used only as a quality/energy reference** — for principles (bold typography, large data visualisations, strategic saturated colour, strong quiet/energetic contrast, large-scale composition). Never as a template. Do not copy its layouts, branding, colours or components.

---

## 8. UX/UI TOOLS AND DESIGN CAPABILITIES USED

| Tool | Type | What it was used for |
|---|---|---|
| **UI UX Pro Max** v2.13.0 | Claude Code skill (plugin) | Design-system generation, UX guideline lookups, density/motion/variance dials. Confirmed "Data-Dense Dashboard" style and "blue data + amber highlights". **Its "Modern Dark / glassmorphism" recommendation was explicitly rejected** |
| **21st MCP** | MCP server | Read-only component/pattern research (~9 searches): SaaS nav, command palettes, data tables, empty states, onboarding, KPI cards, mobile nav, AI agent states, telemetry. **Nothing was installed.** Key finding: the "AI feeling" comes from a *visible state machine*, not a look |
| **dataviz** | Claude Code skill | Categorical palette method + **`scripts/validate_palette.js`** — the six-check validator (lightness band, chroma floor, CVD separation, normal-vision floor, contrast). Used to validate the Signal series palette in both modes |
| **Claude in Chrome** | Browser MCP | Live inspection of the running product — screenshots, computed styles, `performance` API, console, localStorage checks. Found the hydration failure, the 16px hero, and the rAF/hidden-tab artifact |
| Python (3.13) | CLI | Ad-hoc OKLab/WCAG contrast solvers for palette derivation |

**For Cursor:** the two capabilities that mattered most were **(a) real browser inspection of the rendered product** and **(b) a runnable colour validator**. Source-only review would have missed nearly every defect in section 10.

---

## 9. AUTH / TENANCY / SECURITY

**Model:** Supabase Auth → bearer token in `localStorage` → `authedFetch` attaches `Authorization` → server validates and authorises per brand.

**Roles:**
- `admin` — may see all brands; `brand_id` may be `null`
- `customer` — pinned to their own `brand_id`

**Portal brand resolution (`lib/portalAuth.tsx`):**
1. Customer → always their own `me.brand_id`. **Never overridable.**
2. Admin → `?brand=` query param (set by the dashboard's "Preview the customer experience" link)
3. Admin fallback → first brand from `/api/platform`

**Why the fallback is safe:** `/api/platform` is server-side authorised and returns only brands the caller may see. It is a *permitted* brand, never a guess. **Do not replace this with a client-side brand list.**

**API pattern (follow it):**
```ts
const auth = await requireAuth(req);        if (isAuthError(auth)) return auth;
const brandId = url.searchParams.get("brand");
const err = requireBrandAccess(auth, brandId); if (err) return err;
// rate limit AFTER authorisation, so unauthorised callers can't burn a tenant's quota
```

**Robustness changes made this session:**
- The provider's async block had **no `try`/`catch`** — a single rejected `await` skipped `setState` and left `loading:true` **forever**. Now every path settles.
- `getJson()` checks `res.ok` before parsing (previously `.json()` on an HTML error page threw)
- Cancellation guard on unmount
- `ShellError` now offers **"Choose a customer"** (admins → `/dashboard`) and **"Try again"** instead of a dead end

**Never weaken:**
- Tenant isolation — a customer must never see another brand
- Server-side authorisation on every `/api/*` route
- RLS posture on `jobs` (service-role only)
- `INTEGRATION_ENCRYPTION_KEY` usage for stored credentials
- `white-label.test.ts` — platform identity vs tenant identity separation

---

## 10. BUGS DISCOVERED AND FIXED

| # | Bug | Root cause | Fix |
|---|---|---|---|
| 1 | **Portal infinite skeleton** | `PortalAuthProvider` async block had no `try`/`catch`; any rejection skipped `setState` → `loading:true` forever | Full try/catch, `res.ok` checks, every path settles, recovery UI |
| 2 | **React never hydrated** (`/portal` dead, 0 API calls) | **Stale `.next` build cache** | Cleared `.next`, clean restart. Confirmed fixed |
| 3 | **`.next` contention** | Running `npm run build` while `next dev` was live → `MODULE_NOT_FOUND` in `.next/server/app/portal/page.js` | Never build against a live dev server. See §11 |
| 4 | **Whole app rendered in Times New Roman** | `--font-sans: var(--font-inter)` had **no fallback**. When next/font's stylesheet didn't load, the declaration became invalid and *every* `font-family: var(--font-sans)` collapsed | `var(--font-inter, 'Inter')` — a missing font now costs a webfont, not the type system |
| 5 | **Hero title rendered at 16px** | An edit left **orphaned prose after a closed comment** inside `GLOBAL_CSS` — invalid CSS that silently invalidated `--fz-display`/`--fz-title` | Comment repaired. Guard: comment delimiters balance, and all display tokens must survive comment-stripping |
| 6 | **Sidebar read "Junk FreeAI SEO Platform"** | `.p-side-names` children were both `display:inline` | `display:flex; flex-direction:column` |
| 7 | **Dashboard looked empty for 2–3s / forever in a background tab** | Entrance animations gated visibility; Framer uses rAF, which browsers **pause in hidden tabs** | Entrance animation removed from `Panel`, `Stagger`, `StaggerItem`, `MissionHero`, `EmptyState` |
| 8 | **Structurally empty health scores** | A ring at 0 is indistinguishable from one that never loaded | A score at 0 or `null` now always carries its explanatory line. **The number is never altered** |
| 9 | Six soft-badge pairs at 4.0–4.4:1 | Soft backgrounds chosen for appearance, never checked against their own foregrounds | Solved opaque `-soft` steps |
| 10 | White on gradient CTA = 2.67:1 | Gradient light stop | Solid brand fills + `--on-accent` |
| 11 | `.sr .ov-hint` = 1.95:1 | Literal `#B2BAC8` on white | Tokenised |
| 12 | Intelligence greys `#9AA3B2` (2.80:1), `#8A93A6` (3.02:1) used as body text | Private colour scheme | Moved to `app/dashboard/intelligence/palette.ts` |

**Non-bug worth recording:** elements measuring `opacity: 0` long after load was a **measurement artifact** — the tab was `hidden`, so rAF never fired. Verified via `document.visibilityState` / `hasFocus` / a rAF probe. It did, however, expose bug #7.

---

## 11. DEVELOPMENT ENVIRONMENT LESSONS

### The critical one
**Never run `npm run build` while `next dev` is running.** They share `.next`. Doing so corrupted the dev server's module graph (`MODULE_NOT_FOUND`) and almost certainly caused the earlier "hydration failure" too. Diagnosis time lost: substantial.

### Stable workflow
1. **One** dev server at a time, on **`localhost:3000`**
2. Stop the dev server **before** any production build
3. Port stability matters: `localStorage` is scoped per **origin including port**, so a new port = a lost session. Seven ports were burned this session for exactly this reason
4. Before killing anything: verify the PID's command line (`Get-CimInstance Win32_Process`) belongs to this project
5. Background dev-server tasks can be reported "killed" while the OS process survives — **16 orphaned node processes** accumulated across 8 ports

### Deliberately untouched
A node process pair (**PIDs 9544, 12976, port 3001**) started **08/08/2026**, predating this work. It was **not** terminated because it could not be confirmed as belonging to this session. Leave it alone unless you verify otherwise.

---

## 12. CURRENT VERIFIED STATE

Verified at handoff:

| Item | Value |
|---|---|
| **Tests** | **351 passing**, 29 files, 0 failing |
| **Typecheck** | `npx tsc --noEmit` — **clean** |
| **Production build** | **Compiles successfully**, 53/53 static pages |
| **Shared JS** | **102 kB** first-load, unchanged across the redesign |
| **Dev server** | **Stopped.** Only the pre-existing 3001 pair remains |
| **Git branch** | `main`, last commit `3a9be1b "Phase 1.6: tenant-aware rate limiting"` |
| **Committed** | **Nothing.** No commit made |
| **Pushed** | **No** |
| **Deployed** | **No** |
| **Supabase modified** | **No** — no schema, data, or migration changes |

**Working tree:** 34 modified files, 6 untracked (+1257 / −458 lines).

---

## 13. KNOWN UNVERIFIED AREAS

Stated plainly — do not assume these work:

1. **Real mobile breakpoint** — never confirmed. `resize_window` did not change the viewport (`innerWidth` stayed 1173/2048), so real breakpoints never fired. Mobile *rules* were verified by force-applying the media block; the live experience was not. **Highest-priority verification gap.**
2. **Dark mode after Operator typography + composition** — tokens are verified by test, but the dark portal has not been *seen* since the display-scale and health-score changes.
3. **`ShellError` "Choose a customer" button** — the catch path was seen live (under a real 500), but the admin variant with the dashboard link was never rendered on screen.
4. **The 3-card + pending-line health row in dark mode** — light only.
5. **Tablet breakpoints** — untested.
6. **Print/report view** after the composition changes.
7. **Learning loop** — whether `lib/learning.ts` measurably influences future runs.
8. Whether the traffic chart at 380px pushes content below the fold on a 1280×800 laptop.

---

## 14. CURRENT PRODUCT/DESIGN DEBT

### Visual/design debt
- **The dashboard is still fundamentally a two-column card layout.** This is the honest, central gap. Typography and colour now carry real confidence, but the *composition* remains a grid of boxes. Reaching the target bar requires layout-architecture change, not more styling.
- Only one screen (`/portal`) has a "large data moment". The other 12 routes have not been composed.
- Charts beyond the main traffic chart are still small.
- The empty-state block still carries the `--mesh` wash, which reads slightly tinted against the now-flat panels.

### Architecture debt
- **`app/dashboard/page.tsx`** — 815+ lines mixing markup, data fetching, validation, business logic and ~220 lines of CSS. Highest-risk file in the repo.
- **Admin surface has no dark mode.** An admin toggling dark in the portal then clicking "Back to admin" hits a bright white screen.
- `PORTAL_CSS` (~1000 lines) is injected at runtime inside a client component rather than served as a static stylesheet.
- Ten-plus card classes could consolidate to three roles (Panel / Tile / Row-card).

### Product/feature debt
- No global search or command palette across 13+ destinations
- No Google Business Profile integration (Local SEO is structurally incomplete)
- Billing is entirely placeholder
- No onboarding progress model ("3 of 6 connected")
- No staleness indicators on cron-fed data
- Intelligence sub-tab state is not in the URL — not shareable, back button broken

### Technical debt
- Font weights `660`/`720` render as `700` because `next/font` loads **static** Inter instances. Deliberately deferred — changing values *or* switching to a variable font is a visible change deserving its own phase.
- Half-pixel sizes (`10.5`, `11.5`, `13px`) have no matching token.
- No E2E tests; all 351 tests are unit/structural.

---

## 15. ORIGINAL ROADMAP / REMAINING PHASES

**P1–P3 are COMPLETE.** The Signal / Operator foundation is complete. **P4 has NOT started.**

### P4 — Navigation & command surface *(next)*
**Objective:** make a 13-destination product navigable and give it a professional command surface.

**Scope (recovered from the original audit):**
1. **Sidebar regrouping** by user intent — currently 9 unlabelled items in one list. Proposed:
   - *Overview* → Dashboard
   - *Act* → Opportunities, Content, Reviews
   - *Analyse* → Intelligence, Competitors, Reports
   - *Site* → Website, Technical SEO, Local SEO
   - *Manage* → Settings, Billing
   - *Assistant* → AI Assistant (pinned to footer)
2. **Desktop header** — currently `.p-topbar` is mobile-only; desktop has nowhere for search, brand switching, notifications or account. Proposed slim ~52px bar.
3. **Command palette (⌘K / Ctrl+K)** — over **routes, records and verbs** (keywords, competitors, drafts, pages; "run audit", "approve draft"). 21st research finding: multi-source is the pattern that matters here.
4. **Nav badge counts** — pending drafts / unanswered reviews are already computed on the dashboard.
5. **Intelligence sub-tab state → URL** — currently component state; breaks sharing and the back button.
6. **Bottom-nav badge counts** on mobile.
7. **Breadcrumbs on Intelligence only** (the one section with real depth).

**Dependency:** **P0 — decide the real product name** (see §16). P4 is where identity becomes visible; building the header/nav against a placeholder wastes the moment.

**Risks:** regrouping could make a destination harder to find — verify no route becomes less discoverable. The palette is additive and low-risk.

### P5 — Dashboard reprioritisation
**Objective:** make the dashboard tell the right story.
- Promote **"Needs your attention"** to primary position — `buildPriorities()` already produces exactly what the user came for, but it sits in the narrow right column
- Collapse remaining locked KPIs into a single "Connect lead & call tracking" row card (stronger conversion surface than four inert tiles)
- Add an **onboarding progress model** ("3 of 6 connected")
- Add **staleness indicators** to cron-fed data
**Partially complete:** health-score collapse and the 380px chart were done during Signal/Operator.
**Risk:** recomposition only — every value is already computed. Validate with a real tenant.

### P6 — Component consolidation
Ten-plus card classes → **Panel / Tile / Row-card**. Add `surfaceCSS()` as a fourth generator. Generalise `useDialog` into a Dialog component. Add a general tooltip. Standardise on the segmented tab control.
**Risk:** touches every page. Do **after** P4/P5 settle the vocabulary.

### P7 — Table data layer
Universal sorting, filtering, sticky headers, density toggle, bulk selection; a **no-results state distinct from no-data**. `.p-table-sort` exists but is not universally applied.
**Note:** UI UX Pro Max flagged "no filtering" as an anti-pattern for this product type.

### P8 — Admin dashboard alignment
Extract CSS from `page.tsx` into `adminTheme.ts`; adopt `surfaceCSS()`; **add dark mode**; split the 815-line component into per-tab modules.
**Highest risk, lowest customer visibility — deliberately last**, so the admin is aligned to a finished target.

**Recommended order:** P0 → P4 → P5 → P6 → P7 → P8.

---

## 16. PRODUCT NAME / IDENTITY

**Current state — verified in the repository:**
```ts
// lib/ui/tokens.ts:24
export const PLATFORM_NAME = "SEO Platform";
```
Flagged in-source as *"deliberately a placeholder label until a real product name is chosen."*

**Four competing self-descriptions exist today:**
1. `PLATFORM_NAME` = "SEO Platform"
2. Portal sidebar sub-label = "AI SEO Platform"
3. Login mark = "Autonomous SEO Platform"
4. Root metadata description = "Autonomous SEO operations dashboard"

**Where identity surfaces:** browser title via `pageTitle(tenantName)`, portal sidebar, login screen, root metadata, and (future) the desktop header and command palette.

**Critical architecture note:** `PLATFORM_NAME` is the **platform's** name and must never be a tenant's. A tenant's name comes from `brands.name` and is applied per page. A previous bug had every tenant seeing one customer's business name in their browser tab — `white-label.test.ts` guards this. **Do not regress it.**

**No name is proposed here.** This is a business decision, and it should be made **before or at the start of P4**.

---

## 17. FUTURE WEBSITE-BUILDER / EXECUTION VISION

**Implemented today:**
- `lib/execution/` — a real execution engine with a typed adapter registry
- **Adapters: WordPress and generic webhook** (`lib/execution/adapters/`)
- `/api/execution` — resolves a publish target, checks credentials with a live call, dispatches approved drafts
- `supabase/011_publish_executions.sql` — execution records
- Credentials encrypted via `INTEGRATION_ENCRYPTION_KEY`
- `AUTO_PUBLISH` env flag exists

**This is genuinely implemented, not mocked** — approved drafts can reach a customer's live WordPress site.

**Future vision (stated by the product owner; no repository implementation yet):**
- **Shopify** and other CMS adapters
- **One-click / OAuth-style connection** instead of manual API credential entry
- Automated implementation rather than copy/paste
- Possible website-builder / hosted-site direction

**Do not represent Shopify or one-click OAuth connection as existing.** The adapter registry is the correct extension point.

---

## 18. AI AGENT ARCHITECTURE

### Actually implemented
- **Job queue** (`lib/queue.ts`) — Postgres-backed, brand-scoped, **atomic claim** (the UPDATE is conditioned on status still being `queued`, so two racing callers can't both win)
- **Statuses** — `queued → running → done | failed`
- **Job kinds** — `plan, content, geo, gbp, citations, audit, performance, rank_sync, rank_enrich, publish`
- **Cron orchestration** — 3 Vercel cron endpoints
- **Job recovery** — `lib/runHealth.ts` reads back failure reasons; stale jobs are reclaimed (observed live: *"stale: reclaimed after 1h timeout"*)
- **Telemetry** — `started_at`, `finished_at`, `duration_ms`, `error` (migration 005). **Written best-effort** — the queue works before 005 is applied, so all timing fields are nullable
- **Brand locks** — `brand_locks` table + `acquire_brand_lock()` RPC prevent concurrent runs per tenant
- **Drafts/approval** — draft → approve → publish, with revise
- **Agent activity** (new) — `lib/agentActivity.ts` + `/api/portal/activity`, read-only
- **Learning** — `lib/learning.ts` exists

### Visual-only (no new backend)
- The agent-activity feed is **presentation over real rows**. It invents nothing: where a duration is unknown (005 not applied), the field is **omitted rather than estimated**.

### To become a genuinely autonomous SEO operating system
1. **Confidence/decision surfacing** — opportunities are ranked but the basis isn't exposed
2. **Auto-approval policy** — `AUTO_PUBLISH` exists but there is no per-tenant risk policy or blast-radius control
3. **Outcome attribution** — close the loop: did an executed change move the ranking?
4. **Rollback** — no way to revert an executed site change
5. **More adapters** — WordPress + webhook covers a minority of the market
6. **Agent observability for operators** — run traces, step timing, cost per run
7. **Real-time push** — activity currently polls (15s, only while work is in flight)

---

## 19. DATA / INTEGRATIONS

| Integration | State | Notes |
|---|---|---|
| **Supabase** | Implemented | Postgres + Auth. Migrations 004–012 |
| **Anthropic** | Implemented | `lib/anthropic.ts`; model via `ANTHROPIC_MODEL` (default `claude-sonnet-5`). Prompts/responses deliberately **not** logged in production |
| **DataForSEO** | Implemented | Rank sync + weekly enrichment |
| **Google Search Console** | Implemented | Metrics, striking-distance keywords |
| **Google OAuth** | Implemented | `lib/google/` — connect, token store, property selection |
| **WordPress** | Implemented | Real publish adapter |
| **Generic webhook** | Implemented | Real publish adapter |
| **Google Business Profile** | **Not implemented** | `gbpScore` hardcoded `null`. GBP posts are *drafted* but not published to Google |
| **Payment provider** | **Not implemented** | Billing entirely placeholder |
| **Lead / call tracking** | **Not implemented** | KPIs deliberately `locked` |
| **Analytics (GA4 etc.)** | **Not implemented** | "Conversions" KPI locked |
| **Shopify / other CMS** | **Planned** | Adapter registry is the extension point |

---

## 20. NON-NEGOTIABLE GUARDRAILS FOR THE NEXT AGENT

1. **Never weaken tenant isolation.** A customer sees exactly one brand.
2. **Do not modify Supabase** (schema, data, migrations) without explicit approval.
3. **Do not commit, push, or deploy** without explicit approval.
4. **Preserve the Signal semantic roles.** Brand = action. Violet = machine only. Green/amber/red = status only, never a chart series.
5. **Do not introduce colours outside the system.** Run the dataviz validator for any new categorical palette; keep OKLab pair separation ≥ 0.10.
6. **Do not undo P1–P3** — contrast fixes, token architecture, touch targets, focus rings, reduced motion, card-stack tables, honest empty/locked states.
7. **Do not reintroduce a serif display face** in the product (`tokens.test.ts` enforces).
8. **Do not turn this into generic AI SaaS** — no gradients, glass, glow, neon, or sparkle icons.
9. **Inspect the rendered UI, not just the code.** Most defects in §10 were invisible in source.
10. **Run `npm test` and `npx tsc --noEmit`** after every meaningful change (351 tests currently pass).
11. **Stop the dev server before running a production build.** They clobber `.next`.
12. **Never blindly kill Node processes** — verify the command line belongs to this project first.
13. **Distinguish real data from placeholders.** Never invent telemetry. If a duration is unknown, omit it.
14. **Do not change product behaviour for visual reasons.** Presentation-only means presentation-only.
15. **Keep bundle discipline** — `LazyMotion` + `m`, dynamic import of the Intelligence tab, one font family.
16. **Never put backticks inside a CSS template literal comment** — it terminates the string. This caused build breaks three times.

---

## 21. RECOMMENDED NEXT STEP

**P4 has not started. Do not begin it immediately.**

**Do first, in order:**

1. **Verify the unverified** (§13) — highest value, low cost:
   - Real mobile breakpoint on a signed-in portal (DevTools device toolbar)
   - Dark mode across the portal after the Operator changes
   - The `ShellError` admin recovery path
2. **Decide the product name (P0).** It blocks the identity-bearing parts of P4.
3. **Consider a checkpoint commit** (§23) before another agent starts.

**Then begin P4**, in this order (safest → most invasive):
1. Command palette (⌘K) — additive, low risk, highest perceived value
2. Intelligence tab state → URL — small, fixes a real UX defect
3. Nav regrouping + badge counts — verify nothing becomes harder to find
4. Desktop header — needs the product name

**If you would rather increase visual quality before P4**, the honest highest-value item is §14's first line: the dashboard is still a two-column card layout. That is a composition/layout change, and it is a legitimate alternative to starting P4.

---

## 22. IMPORTANT FILES

| File | Why |
|---|---|
| **`lib/ui/tokens.ts`** | **Read first.** Shared foundation: Signal palette, display scale, breakpoints, motion, CSS generators. Heavily commented with rationale |
| `app/portal/portalTheme.ts` | ~1000-line portal design system, light + dark |
| `lib/ui/instrument.test.ts` | Enforces Signal — contrast, pair separation, azure discipline, no-serif |
| `lib/ui/tokens.test.ts` | Breakpoints, font stacks, touch floor, spacing |
| `lib/ui/phase5.test.ts` | Per-surface contrast contract |
| `lib/ui/phase6.test.ts` | Token scales + structural CSS integrity |
| `lib/portalAuth.tsx` | Brand resolution + tenancy rules + robustness fixes |
| `app/portal/PortalShell.tsx` | Portal shell, nav, drawer, bottom nav, `ShellError` |
| `app/portal/page.tsx` | Customer dashboard — the most designed screen |
| `app/portal/_components/MetricCard.tsx` | Dimension-coloured KPI tile; three honest states |
| `app/portal/_components/AgentActivity.tsx` | Agent activity UI |
| `lib/agentActivity.ts` | Read-only agent activity data layer; the pattern to copy |
| `lib/queue.ts` | Job queue, atomic claim |
| `lib/runner.ts`, `lib/steps.ts` | Agent execution |
| `lib/execution/engine.ts`, `registry.ts` | Site execution + adapter registry |
| `app/dashboard/page.tsx` | Admin surface — largest, riskiest file |
| `app/dashboard/intelligence/palette.ts` | Chart/status colours for Intelligence |
| `app/_components/Notify.tsx` | Toasts + confirm dialog (root-mounted) |
| `app/_components/ResponsiveTable.tsx` | Card-stack/scroll table |
| `supabase/005_execution_engine.sql` | Job timing columns + brand locks |
| `vercel.json` | Cron schedules |
| `.env.example` | Required environment surface |

---

## 23. CURRENT WORKING TREE

**34 modified, 6 untracked, +1257 / −458.** Nothing committed.

**Untracked (new this session):**
- `app/api/portal/activity/route.ts` — agent activity API
- `app/dashboard/intelligence/palette.ts` — Intelligence chart palette
- `app/portal/_components/AgentActivity.tsx` — agent activity UI
- `lib/agentActivity.ts` — agent activity data layer
- `lib/ui/instrument.test.ts` — Signal enforcement tests
- `.mcp.json` — MCP config (**review before committing; check for secrets**)

**Recommendation: yes, create a checkpoint commit before another agent begins.** The tree contains a coherent, fully green body of work (351 tests, clean typecheck, successful build), and handing an uncommitted 1700-line diff to a new agent risks accidental loss.

**I have NOT created it, as instructed.** Suggested message:

```
Signal / Operator design foundation + portal auth robustness

- Signal colour system: blue brand, violet AI/system, reserved status,
  6-hue validated categorical series (CVD-checked both modes)
- Operator typography: serif removed, display scale to 60px, sans display
- Composition: 380px hero chart, health scores 5 cards -> 3 + pending line
- Motion: entrance animation removed (rAF/background-tab bug)
- Fix: PortalAuthProvider infinite-loading; added recovery UI
- Fix: --font-sans fallback (whole-app Times New Roman collapse)
- Fix: orphaned CSS comment invalidating display tokens
- Fix: sidebar brand/sub-label inline collapse
- Intelligence tab moved onto shared palette; stale colours removed
- New: agent activity data layer, API and UI (read-only over real jobs)
```

**Check `.mcp.json` for credentials before including it.**

---

## 24. HANDOFF WARNINGS

1. **Do not "simplify" the two-surface split.** `.portal` and `.sr` isolation is what makes change safe.
2. **Do not migrate to Tailwind/shadcn.** It would discard the generator architecture and push toward the stock look explicitly rejected.
3. **`MetricCard`'s three states** (real / empty / locked) are a deliberate trust feature. Consolidation must preserve them.
4. **The categorical series order is load-bearing** — re-sorting reintroduces a deuteranopia collision.
5. **`-soft` tokens are opaque on purpose.** Reverting to rgba reintroduces contrast drift.
6. **Entrance animation was removed deliberately** — re-adding it reintroduces the background-tab invisibility bug.
7. **The admin fallback brand is authorised, not guessed.** Do not "harden" it into a client-side list.
8. **Timing fields are nullable by design.** Never estimate a duration.
9. **Font weights 660/720 render as 700** (static Inter instances). "Fixing" the values silently lightens every heading.
10. **`.next` is shared** between dev and build. This corrupted the app twice.
11. **Backticks in CSS-template-literal comments break the build.** Three occurrences.
12. **A background dev-server task reported "killed" may still hold its port.**
13. **`localStorage` is per origin *including port*** — a new port silently loses the session.
14. The **3001 node processes predate this work**; leave them alone.
15. **Semrush is a quality reference only.** Do not copy it.

---

# START HERE FOR THE NEXT AGENT

1. This is an **AI SEO automation platform**, not a reporting dashboard. Agents analyse → recommend → generate → **execute on live sites** → monitor.
2. **Next.js 15 App Router, React 18, TypeScript, Supabase, Anthropic, Recharts, Framer Motion, Vitest, Vercel.** **No Tailwind. No shadcn.** Styling is CSS-in-TS, scoped per surface.
3. **Read `lib/ui/tokens.ts` first.** It is the design foundation and is heavily commented with the reasoning behind every decision.
4. **Two surfaces:** `/portal` (customers, scope `.portal`) and `/dashboard` (admins, scope `.sr`). Keep them isolated.
5. **Signal colour system:** brand blue `#2563EB` = action · violet `#6D3BE4` = **AI/system only** · green/amber/red = status only · 6-hue validated series for data. **Colour must carry meaning.**
6. **Signal / Operator form language:** Inter only (no serif), display scale to 60px @ weight 750, hairline panels, one large data moment per screen, **no entrance animation**.
7. **351 tests pass · typecheck clean · production build compiles (53 pages, 102 kB shared).** Keep it that way.
8. **Nothing is committed.** 34 modified + 6 untracked files. Consider a checkpoint commit first.
9. **Never run `npm run build` while `next dev` is running** — it corrupts `.next`.
10. **One dev server on `localhost:3000`.** A new port loses the session (`localStorage` is per origin+port).
11. **Inspect the rendered UI in a browser.** Most bugs found this session were invisible in source.
12. **P1–P3 are complete. Signal/Operator is complete. P4 has NOT started.**
13. **P4 = nav regrouping + desktop header + ⌘K command palette + Intelligence URL state + badge counts.** It depends on deciding the product name.
14. **`PLATFORM_NAME` is still the placeholder `"SEO Platform"`.** Decide before/within P4. Never let it become a tenant's name.
15. **Biggest honest gap:** the dashboard is still a two-column card layout. Reaching the quality bar needs layout architecture, not more styling.
16. **Biggest verification gap:** real mobile breakpoints were never confirmed. Verify before shipping.
17. **Tenant isolation is sacred.** Customers see one brand. Server-side authorisation on every API route.
18. **Never invent data.** If a value is unknown, omit it. Locked ≠ empty ≠ zero.
19. **Do not commit, push, deploy, or modify Supabase** without explicit approval.
20. **Rejected directions:** indigo-violet gradient, spruce-teal (ΔE 0.051 from green), achromatic graphite (too monochrome), serif display, dark agent sidebar. Do not revive them without reading why.
