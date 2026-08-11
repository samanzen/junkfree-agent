// Design system for the customer Portal. Everything is scoped under .portal so
// it can never bleed into or be affected by the admin dashboard's own styles
// (app/dashboard/page.tsx), which is untouched.
//
// Theme: CSS custom properties on .portal, overridden by [data-theme="dark"]
// and, absent an explicit choice, by prefers-color-scheme. The toggle
// (PortalShell) persists the explicit choice to localStorage.
import {
  touchTargetCSS, responsiveTableCSS, fieldCSS, down,
  semanticVars, MESH_LIGHT, MESH_DARK,
} from "@/lib/ui/tokens";

// Fonts are no longer fetched here. The Google Fonts @import that used to sit
// at the top of this string was inside a runtime-injected <style>, so it could
// not be preloaded and blocked first paint. Inter is now self-hosted via
// next/font in app/layout.tsx and reaches this file as --font-sans.
export const PORTAL_CSS = `

.portal {
  /* ── Layered surfaces: page < sunken < base < raised < overlay ── */
  --bg:#F5F7FA; --bg-2:#EDF1F6;
  --sunken:#EDF1F6; --surface:#FFFFFF; --surface2:#F7F9FC; --surface3:#EFF3F8;
  --raised:#FFFFFF; --overlay:rgba(255,255,255,.88);
  --line:#E1E7EF; --line-soft:#EDF1F6; --line-strong:#CBD5E1;
  --hairline:rgba(255,255,255,.9);
  /* ── Text ──
     muted and muted2 were retuned: at their previous values they cleared 4.5:1
     on --surface but dropped to 4.49 and 4.25 on --surface2, which is the
     background they actually sit on inside panels and KPI cards. */
  --text:#0C1220; --text2:#3B4657; --muted:#5F6B7D; --muted2:#5C6878;
  /* ── Brand, system and data colour, all from the shared palette ──
     --accent is now the achromatic graphite brand; --system is the azure
     reserved for machine activity. See lib/ui/tokens.ts for why. */
  ${semanticVars("light")}
  /* Neutral mesh tints — the hero wash carries no text and no meaning. */
  --accent2:${MESH_LIGHT.a2}; --accent3:${MESH_LIGHT.a3};
  /* ── Depth ── */
  --sh-1:0 1px 2px rgba(10,12,19,.05);
  --sh-2:0 2px 4px rgba(10,12,19,.04), 0 4px 12px rgba(10,12,19,.05);
  --sh-3:0 8px 24px rgba(10,12,19,.08), 0 2px 6px rgba(10,12,19,.04);
  --sh-4:0 20px 56px rgba(10,12,19,.14), 0 6px 16px rgba(10,12,19,.06);
  --sh-glow:0 0 0 1px var(--accent-line), 0 12px 32px var(--accent-glow);
  --glass:rgba(255,255,255,.74);
  /* ── Geometry ──
     Bound to the shared radius scale rather than declaring a parallel one.
     These were 8/11/15/20/26 against the root scale's 6/10/14/20; the 1-2px
     difference bought nothing and meant two scales had to be kept in step. */
  --r-xs:var(--radius-xs); --r-sm:var(--radius-sm); --r:var(--radius-md);
  --r-lg:var(--radius-lg); --r-xl:var(--radius-xl);
  /* ── Mesh ── */
  --mesh:
    radial-gradient(80% 120% at 12% 0%, var(--accent2), transparent 55%),
    radial-gradient(90% 130% at 60% 100%, var(--accent3), transparent 62%);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) { .portal:not([data-theme="light"]) { ${darkVars()} } }
.portal[data-theme="dark"] { ${darkVars()} }

.portal * { box-sizing:border-box; }
.portal {
  min-height:100vh; background:var(--bg); color:var(--text);
  font-family:var(--font-sans);
  font-feature-settings:'cv02','cv03','cv04','ss01','tnum' 0;
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
  letter-spacing:-0.012em;
  transition:background var(--dur-3) var(--ease-out), color var(--dur-3) var(--ease-out);
}
.portal a { color:inherit; }
.portal ::selection { background:var(--accent-glow); }
.portal :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:var(--r-xs); }
.portal ::-webkit-scrollbar { width:11px; height:11px; }
.portal ::-webkit-scrollbar-thumb { background:var(--line-strong); border-radius:var(--r-lg); border:3.5px solid transparent; background-clip:content-box; }
.portal ::-webkit-scrollbar-thumb:hover { background:var(--muted2); background-clip:content-box; }
.portal ::-webkit-scrollbar-track { background:transparent; }

@keyframes pShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes pPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
/* pFloat (a perpetually bobbing chat icon) and pBeacon (a pulsing ring) were
   retired: ambient loops that carry no information, run forever, and cost
   battery on the surface customers keep open. pShimmer and pPulse stay —
   both indicate real state (loading, and a live connection). */

/* ══ App shell ══════════════════════════════════════════════════════ */
.p-shell { display:flex; min-height:100vh; gap:0; }

/* Floating glass sidebar */
.p-side {
  width:252px; flex-shrink:0; position:sticky; top:0; height:100vh; z-index:200;
  display:flex; flex-direction:column; padding:14px 12px 14px 14px;
}
.p-side-inner {
  flex:1; display:flex; flex-direction:column; min-height:0;
  background:var(--glass); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px);
  border:1px solid var(--line); border-radius:var(--r-lg); box-shadow:var(--sh-2);
  overflow:hidden;
}
.p-side-brand { display:flex; align-items:center; gap:12px; padding:16px 16px 14px; border-bottom:1px solid var(--line-soft); }
.p-side-mark {
  width:34px; height:34px; border-radius:var(--r-sm); flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:var(--accent);
  color:var(--on-accent); font-size:13px; font-weight:700; letter-spacing:-.03em;
  box-shadow:0 4px 12px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.3);
}
/* Both children are <span>, so without an explicit column they laid out inline
   and the sidebar read "Junk FreeAI SEO Platform" as one run of text. */
.p-side-names { min-width:0; display:flex; flex-direction:column; }
.p-side-name { font-weight:600; font-size:var(--fz-body); letter-spacing:-.02em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.p-side-sub { font-size:10.5px; color:var(--muted2); margin-top:1.5px; letter-spacing:.01em; }
.p-side-nav { flex:1; overflow-y:auto; padding:10px 8px 12px; display:flex; flex-direction:column; gap:1px; }
.p-nav-label { font-size:10px; font-weight:660; letter-spacing:.09em; text-transform:uppercase; color:var(--muted2); padding:16px 12px 8px; }
.p-nav-item {
  position:relative; display:flex; align-items:center; gap:12px; padding:8.4px 12px; border-radius:var(--r-sm);
  color:var(--muted); font-size:var(--fz-body); font-weight:500; text-decoration:none; cursor:pointer;
  transition:color var(--dur-2) var(--ease-out);
}
.p-nav-ico {
  width:26px; height:26px; border-radius:var(--r-xs); display:flex; align-items:center; justify-content:center;
  flex-shrink:0; position:relative; z-index:1; transition:background var(--dur-2), color var(--dur-2), box-shadow var(--dur-2);
  background:transparent;
}
.p-nav-item:hover { color:var(--text); }
.p-nav-item:hover .p-nav-ico { background:var(--surface3); }
.p-nav-item.on { color:var(--text); font-weight:600; }
.p-nav-item.on .p-nav-ico {
  background:var(--accent);
  color:var(--on-accent); box-shadow:0 3px 10px var(--accent-glow);
}
.p-nav-hl {
  position:absolute; inset:0; border-radius:var(--r-sm); z-index:0;
  background:linear-gradient(90deg,var(--accent-soft),transparent 82%);
  border:1px solid var(--accent-line); border-left:2px solid var(--accent);
}
.p-nav-text { position:relative; z-index:1; }
.p-side-foot { padding:12px 12px 12px; border-top:1px solid var(--line-soft); display:flex; align-items:center; gap:8px; }
.p-icon-btn {
  background:var(--surface); border:1px solid var(--line); color:var(--muted); width:32px; height:32px;
  border-radius:var(--r-xs); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;
  box-shadow:var(--sh-1); transition:color var(--dur-2), border-color var(--dur-2), transform var(--dur-2);
}
.p-icon-btn:hover { color:var(--accent); border-color:var(--accent-line); transform:translateY(-1px); }
.p-signout-btn {
  flex:1; background:var(--surface); border:1px solid var(--line); color:var(--muted); padding:8px 12px;
  border-radius:var(--r-xs); font-size:var(--fz-small); font-family:inherit; cursor:pointer; font-weight:500; box-shadow:var(--sh-1);
  transition:color var(--dur-2), border-color var(--dur-2);
}
.p-signout-btn:hover { color:var(--text); border-color:var(--line-strong); }

.p-main-col { flex:1; min-width:0; display:flex; flex-direction:column; }
.p-topbar {
  display:none; align-items:center; justify-content:space-between; height:58px; padding:0 14px;
  background:var(--glass); backdrop-filter:saturate(180%) blur(18px); -webkit-backdrop-filter:saturate(180%) blur(18px);
  border-bottom:1px solid var(--line); position:sticky; top:0; z-index:150;
}
.p-main { flex:1; max-width:1240px; width:100%; margin:0 auto; padding:44px 40px 110px; }
.p-scrim { display:none; position:fixed; inset:0; background:rgba(6,7,11,.6); backdrop-filter:blur(3px); z-index:190; }
.p-side-mobile { position:fixed; left:0; top:0; display:none; padding:12px; }
/* Phase 2: the last stray breakpoint (1000px) folded onto the shared md token.
   The sidebar is 252px, so it still fits comfortably at 900px — content keeps
   648px, which is wider than the point any layout in here breaks. */
${down.md} {
  .p-side-desktop { display:none; }
  .p-side-mobile { display:flex; }
  .p-topbar { display:flex; }
  .p-scrim.open { display:block; }
  /* Bottom padding clears the fixed bottom nav plus the iOS home indicator. */
  .p-main { padding:22px 16px calc(84px + env(safe-area-inset-bottom)); }
}

.p-preview {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  background:var(--amber-soft); border:1px solid var(--line); border-radius:var(--r);
  padding:8px 10px 8px 16px; margin-bottom:26px; font-size:var(--fz-small); color:var(--text2);
}

/* ══ Typography ═════════════════════════════════════════════════════ */
.p-pagehead { display:flex; align-items:flex-start; justify-content:space-between; gap:26px; margin-bottom:40px; flex-wrap:wrap; }
.p-eyebrow {
  display:inline-flex; align-items:center; gap:8px; font-size:var(--fz-caption); font-weight:660;
  letter-spacing:.09em; text-transform:uppercase; color:var(--accent); margin-bottom:11px;
}
.p-eyebrow::before { content:''; width:5px; height:5px; border-radius:50%; background:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
/* ══ Editorial typography ═══════════════════════════════════════════
   The serif appears at page-title scale and above and nowhere else. Below
   this size it would slow down scanning rather than add refinement, so every
   label, control, table cell and metric stays in Inter. */
.p-h1 {
  font-family:var(--font-display); font-size:var(--fz-title); font-weight:var(--fw-display);
  letter-spacing:var(--tr-display); line-height:var(--lh-display);
  margin:0 0 10px; text-wrap:balance;
}
/* A longer, calmer measure than a dashboard normally allows — this is the one
   place on each page that is READ rather than scanned. */
.p-sub { color:var(--muted); font-size:15px; line-height:1.66; margin:0; max-width:62ch; }

/* ══ Mission Control hero ═══════════════════════════════════════════ */
.p-mission {
  position:relative; overflow:hidden; border-radius:var(--r-xl);
  border:1px solid var(--line); background:var(--mesh), var(--surface);
  box-shadow:var(--sh-3); padding:34px 36px 0;
}
.p-mission::before {
  content:''; position:absolute; inset:0; pointer-events:none; opacity:.4;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.035'/%3E%3C/svg%3E");
}
.p-mission-top { position:relative; display:flex; align-items:center; justify-content:space-between; gap:36px; flex-wrap:wrap; }
.p-mission-greet { font-size:var(--fz-small); font-weight:500; color:var(--muted); margin-bottom:12px; display:flex; align-items:center; gap:8px; }
.p-mission-live { display:inline-flex; align-items:center; gap:6px; font-size:10.5px; font-weight:660; letter-spacing:.07em; text-transform:uppercase; color:var(--green); }
.p-mission-live i { width:6px; height:6px; border-radius:50%; background:var(--green); animation:pPulse 2.4s ease-in-out infinite; }
.p-mission-title {
  font-family:var(--font-display); font-size:var(--fz-display); font-weight:var(--fw-display);
  letter-spacing:var(--tr-display); line-height:var(--lh-display); margin:0 0 14px; text-wrap:balance;
  /* Was a gradient clipped to the glyphs (background-clip:text; color:transparent).
     It is the largest text on the customer's home screen, and clipped text has
     no defined colour in forced-colors mode and renders illegibly when selected.
     A solid ink reads better and costs nothing. */
  color:var(--text);
}
.p-mission-sub { font-size:14.5px; color:var(--muted); line-height:1.6; margin:0; max-width:460px; }
.p-mission-ring { position:relative; flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:12px; }
/* The blurred halo behind the score ring is gone with the aurora — the ring is
   a data display and reads more precisely without a glow around it. */
.p-mission-verdict { font-size:11.5px; font-weight:600; letter-spacing:.02em; padding:4px 12px; border-radius:var(--r-lg); }
.p-mission-strip {
  position:relative; display:grid; grid-template-columns:repeat(auto-fit,minmax(132px,1fr));
  margin:30px -36px 0; border-top:1px solid var(--line-soft); background:var(--surface2);
}
.p-mission-cell { padding:16px 20px; border-right:1px solid var(--line-soft); }
.p-mission-cell:last-child { border-right:0; }
.p-mission-cell-label { font-size:10.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--muted2); margin-bottom:6px; }
.p-mission-cell-val { font-size:28px; font-weight:700; letter-spacing:-.03em; font-variant-numeric:tabular-nums; display:flex; align-items:baseline; gap:8px; }
${down.sm} {
  .p-mission { padding:26px 22px 0; }
  .p-mission-strip { margin:24px -22px 0; }
  .p-mission-top { flex-direction:column; align-items:flex-start; }
}

/* ══ Quick actions ══════════════════════════════════════════════════ */
/* The hero previously stacked five decorative layers: a mesh gradient, a
   blurred aurora, an SVG noise overlay, a radial glow behind the score ring and
   gradient-clipped title text. Individually defensible, together the one place
   the product read as trying too hard. The aurora is gone; the mesh and noise
   remain, which is enough to keep the hero distinct from a plain panel. */
.p-mission-top, .p-mission-strip { position:relative; z-index:1; }
.p-mission-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:22px; }
.p-quick {
  display:inline-flex; align-items:center; gap:8px; text-decoration:none;
  background:var(--surface); border:1px solid var(--line); color:var(--text2);
  padding:8px 12px; border-radius:var(--r-sm); font-size:var(--fz-small); font-weight:500;
  box-shadow:var(--sh-1); transition:border-color var(--dur-2), color var(--dur-2), transform var(--dur-2), box-shadow var(--dur-2);
}
.p-quick:hover { border-color:var(--accent-line); color:var(--accent); transform:translateY(-1px); box-shadow:var(--sh-2); }
.p-quick-count { font-size:var(--fz-caption); font-weight:700; padding:1px 8px; border-radius:var(--r-lg); font-variant-numeric:tabular-nums; }
.p-quick-arrow { opacity:.45; transition:transform var(--dur-2), opacity var(--dur-2); }
.p-quick:hover .p-quick-arrow { opacity:1; transform:translateX(2px); }

/* ══ AI briefing band ═══════════════════════════════════════════════ */
/* The AI briefing is machine output, so it carries --system rather than the
   brand. This is the rule for every surface below: azure marks work the
   platform did on its own. */
.p-ai {
  position:relative; overflow:hidden; border-radius:var(--r-xl); border:1px solid var(--system-line);
  background:var(--mesh), var(--surface); box-shadow:var(--sh-2); padding:26px 28px;
  display:flex; flex-direction:column; gap:20px;
}
.p-ai-head { display:flex; align-items:center; gap:12px; }
.p-ai-mark {
  width:38px; height:38px; border-radius:var(--r-sm); flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:var(--system); color:var(--on-system);
}
.p-ai-eyebrow { font-size:10.5px; font-weight:660; letter-spacing:.09em; text-transform:uppercase; color:var(--system); }
.p-ai-title { font-size:var(--fz-h3); font-weight:660; margin:4px 0 0; letter-spacing:-.026em; }
.p-ai-signals { display:grid; grid-template-columns:repeat(auto-fit,minmax(206px,1fr)); gap:12px; }
.p-ai-signal {
  display:flex; align-items:center; gap:12px; padding:16px 16px; border-radius:var(--r);
  background:var(--surface2); border:1px solid var(--line-soft); height:100%;
  transition:border-color var(--dur-2), background var(--dur-2), transform var(--dur-2);
}
.p-ai-signal-link { text-decoration:none; color:inherit; }
.p-ai-signal-link:hover { border-color:var(--accent-line); background:var(--surface); transform:translateY(-2px); box-shadow:var(--sh-2); }
.p-ai-count { font-size:26px; font-weight:700; letter-spacing:-.038em; line-height:1; font-variant-numeric:tabular-nums; flex-shrink:0; }
.p-ai-label { font-size:var(--fz-small); color:var(--text2); line-height:1.42; flex:1; }
.p-ai-arrow { color:var(--muted2); flex-shrink:0; transition:transform var(--dur-2), color var(--dur-2); }
.p-ai-signal-link:hover .p-ai-arrow { color:var(--accent); transform:translateX(2px); }
.p-ai-opp {
  display:flex; align-items:center; gap:18px; flex-wrap:wrap;
  padding:18px 20px; border-radius:var(--r); border:1px solid var(--accent-line);
  background:linear-gradient(120deg,var(--accent-soft),transparent 70%), var(--surface);
}
.p-ai-opp-tag { font-size:10.5px; font-weight:660; letter-spacing:.08em; text-transform:uppercase; color:var(--accent); width:100%; }
.p-ai-opp-body { flex:1; min-width:200px; }
.p-ai-opp-kw { font-size:19px; font-weight:660; letter-spacing:-.028em; line-height:1.3; }
.p-ai-opp-meta { font-size:var(--fz-small); color:var(--muted); margin-top:5px; }
.p-ai-opp-meta b { color:var(--text2); font-weight:660; font-variant-numeric:tabular-nums; }
.p-ai-opp-cta { flex-shrink:0; }
${down.sm} { .p-ai { padding:22px 18px; } .p-ai-opp-cta { width:100%; } }

/* ══ AI Opportunities ═══════════════════════════════════════════════ */
.p-opp-list { display:flex; flex-direction:column; gap:12px; }
.p-opp {
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg);
  padding:18px 20px; box-shadow:var(--sh-1); transition:border-color var(--dur-2), box-shadow var(--dur-2);
}
.p-opp:hover { border-color:var(--line-strong); box-shadow:var(--sh-2); }
.p-opp-head {
  display:flex; align-items:center; gap:14px; width:100%; background:none; border:0;
  padding:0; font:inherit; color:inherit; cursor:pointer; text-align:left;
}
.p-opp-headmain { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
.p-opp-kind { font-size:10.5px; font-weight:660; letter-spacing:.07em; text-transform:uppercase; color:var(--muted2); }
.p-opp-title { font-size:var(--fz-lead); font-weight:600; letter-spacing:-.024em; line-height:1.35; }
.p-opp-facts { display:flex; gap:22px; flex-shrink:0; }
.p-opp-fact { display:flex; flex-direction:column; gap:2px; font-size:10.5px; color:var(--muted2); letter-spacing:.02em; }
.p-opp-fact b { font-size:var(--fz-small); font-weight:600; color:var(--text2); letter-spacing:-.01em; }
.p-opp-chev { color:var(--muted2); flex-shrink:0; display:flex; }
.p-opp-impact { display:flex; flex-wrap:wrap; gap:8px; margin-top:13px; }
.p-opp-chip {
  font-size:11.5px; font-weight:500; padding:3.4px 10px; border-radius:var(--r-lg);
  background:var(--surface2); border:1px solid var(--line-soft); color:var(--text2);
  font-variant-numeric:tabular-nums;
}
.p-opp-body { display:grid; grid-template-columns:1.15fr 1fr; gap:22px; padding:18px 0 4px; }
.p-opp-section h4 { font-size:10.5px; font-weight:660; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:0 0 8px; }
.p-opp-section p { font-size:13px; line-height:1.7; color:var(--text2); margin:0; }
.p-opp-steps { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.p-opp-steps li { display:flex; align-items:flex-start; gap:8px; font-size:var(--fz-small); line-height:1.5; color:var(--text2); }
.p-opp-steps svg { color:var(--green); flex-shrink:0; margin-top:2px; }
.p-opp-expand {
  display:inline-flex; align-items:center; gap:6px; margin-top:14px; background:none; border:0;
  color:var(--accent); font-family:inherit; font-size:var(--fz-small); font-weight:600; cursor:pointer; padding:0;
}
.p-opp-expand:hover { text-decoration:underline; }

/* ══ Execution panel ════════════════════════════════════════════════ */
.p-exec-panel { display:flex; flex-direction:column; gap:20px; margin-top:18px; padding-top:17px; border-top:1px solid var(--line-soft); }
.p-exec-group { display:flex; flex-direction:column; gap:10px; }
.p-exec-grouphead {
  display:flex; align-items:center; gap:6px; font-size:10.5px; font-weight:660; letter-spacing:.08em;
  text-transform:uppercase; color:var(--muted); margin:0;
}
.p-exec-grouphead svg { color:var(--accent); }
.p-exec-caps { display:grid; grid-template-columns:repeat(auto-fit,minmax(268px,1fr)); gap:8px; }
.p-cap {
  display:flex; align-items:center; gap:12px; text-align:left; width:100%;
  padding:12px 14px; border-radius:var(--r-sm); border:1px solid var(--line-soft);
  background:var(--surface2); font-family:inherit; color:inherit;
  transition:border-color var(--dur-2), background var(--dur-2), transform var(--dur-2);
}
.p-cap-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
.p-cap-label { font-size:13px; font-weight:600; letter-spacing:-.012em; }
.p-cap-produces { font-size:11.5px; color:var(--muted); line-height:1.45; }
.p-cap-run { cursor:pointer; }
.p-cap-run:hover:not(:disabled) { border-color:var(--accent-line); background:var(--surface); transform:translateY(-1px); }
.p-cap-run:disabled { cursor:default; }
.p-cap-link { text-decoration:none; cursor:pointer; }
.p-cap-link:hover { border-color:var(--accent-line); background:var(--surface); transform:translateY(-1px); }
.p-cap-go {
  flex-shrink:0; font-size:11.5px; font-weight:660; color:var(--accent);
  background:var(--accent-soft); border:1px solid var(--accent-line); padding:4px 12px; border-radius:var(--r-lg);
}
.p-cap-done { flex-shrink:0; color:var(--green); display:flex; }
.p-cap.is-done { border-color:transparent; background:var(--green-soft); }
.p-cap-arrow { color:var(--muted2); flex-shrink:0; }
.p-cap-soon { opacity:.62; }
.p-cap-soontag {
  flex-shrink:0; display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:660;
  letter-spacing:.05em; text-transform:uppercase; color:var(--muted); background:var(--surface3);
  border:1px solid var(--line); padding:4px 8px; border-radius:var(--r-lg); white-space:nowrap;
}
.p-exec-queue { display:flex; flex-direction:column; gap:8px; }
.p-qitem {
  display:flex; align-items:center; gap:14px; padding:12px 14px; border-radius:var(--r-sm);
  background:var(--surface2); border:1px solid var(--line-soft); flex-wrap:wrap;
}
.p-qitem-main { flex:1; min-width:180px; display:flex; flex-direction:column; gap:4px; }
.p-qitem-title { font-size:13px; font-weight:600; letter-spacing:-.012em; }
.p-qitem-meta { font-size:11.5px; color:var(--muted); line-height:1.45; }
.p-qitem-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.p-qitem-btn { padding:6.4px 12px; font-size:12px; }
.p-qitem-state { display:inline-flex; align-items:center; gap:4px; }
.p-exec-more {
  display:inline-flex; align-items:center; gap:4px; font-size:var(--fz-small); font-weight:600;
  color:var(--accent); text-decoration:none; margin-top:2px;
}
.p-exec-more:hover { text-decoration:underline; }
${down.md} {
  .p-opp-facts { display:none; }
  .p-opp-body { grid-template-columns:1fr; gap:16px; }
}

/* ══ Timeline ═══════════════════════════════════════════════════════ */
.p-timeline { display:flex; flex-direction:column; }
.p-tl-item { display:flex; gap:14px; align-items:stretch; }
.p-tl-rail { position:relative; width:11px; flex-shrink:0; display:flex; justify-content:center; }
.p-tl-rail::before {
  content:''; position:absolute; top:0; bottom:0; width:1px; background:var(--line);
}
.p-tl-item:first-child .p-tl-rail::before { top:9px; }
.p-tl-item:last-child .p-tl-rail::before { bottom:calc(100% - 9px); }
.p-tl-dot {
  position:relative; z-index:1; width:9px; height:9px; border-radius:50%; margin-top:5px;
  box-shadow:0 0 0 3px var(--surface);
}
.p-tl-body { flex:1; min-width:0; padding:0 0 18px; }
.p-tl-head { display:flex; align-items:center; gap:8px; }
.p-tl-icon { flex-shrink:0; display:flex; }
.p-tl-title { font-size:var(--fz-body); font-weight:500; letter-spacing:-.012em; line-height:1.4; }
.p-tl-meta { font-size:11.5px; color:var(--muted); margin-top:3px; }

/* ══ Technical SEO findings ═════════════════════════════════════════ */
.p-tech-findings { display:flex; flex-direction:column; gap:8px; margin-bottom:4px; }
.p-tech-finding {
  display:flex; align-items:flex-start; gap:12px; padding:14px 16px; border-radius:var(--r-sm);
  background:var(--surface2); border:1px solid var(--line-soft); transition:border-color var(--dur-2);
}
.p-tech-finding:hover { border-color:var(--line); }
.p-tech-finding-ico {
  width:28px; height:28px; border-radius:var(--r-xs); flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:var(--amber-soft); color:var(--amber);
}
.p-tech-finding-title { font-size:var(--fz-body); font-weight:600; letter-spacing:-.014em; line-height:1.4; }
.p-tech-finding-url {
  display:inline-block; margin-top:3px; font-size:11.5px; color:var(--accent);
  text-decoration:none; font-family:var(--font-mono);
}
.p-tech-finding-url:hover { text-decoration:underline; }
.p-tech-finding-why { font-size:var(--fz-small); color:var(--muted); line-height:1.6; margin-top:6px; }
.p-tech-note {
  display:flex; align-items:flex-start; gap:8px; margin:0 0 16px;
  padding:12px 14px; border-radius:var(--r-sm);
  background:var(--surface2); border:1px solid var(--line-soft);
  font-size:12px; color:var(--muted); line-height:1.6;
}
.p-tech-note svg { color:var(--amber); flex-shrink:0; margin-top:2px; }

/* ══ Competitor Intelligence ════════════════════════════════════════ */
.p-comp-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(256px,1fr)); gap:12px; }
.p-comp {
  position:relative; display:flex; align-items:center; gap:4px;
  background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r);
  transition:border-color var(--dur-2), background var(--dur-2), box-shadow var(--dur-2);
}
.p-comp:hover { border-color:var(--accent-line); background:var(--surface); box-shadow:var(--sh-1); }
.p-comp.on { border-color:var(--accent); background:var(--surface); box-shadow:0 0 0 3px var(--accent-soft); }
.p-comp-main {
  flex:1; min-width:0; display:flex; align-items:center; gap:12px; padding:14px 4px 14px 14px;
  background:none; border:0; font:inherit; color:inherit; cursor:pointer; text-align:left;
}
.p-comp-avatar {
  width:36px; height:36px; border-radius:var(--r-sm); flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:var(--accent); color:var(--on-accent);
  font-size:12px; font-weight:700; letter-spacing:-.02em;
  box-shadow:0 3px 10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.26);
}
.p-comp-info { min-width:0; display:flex; flex-direction:column; gap:2px; }
.p-comp-domain { font-size:var(--fz-body); font-weight:600; letter-spacing:-.016em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.p-comp-meta { font-size:11.5px; color:var(--muted); }
.p-comp-remove {
  flex-shrink:0; background:none; border:0; color:var(--muted2); cursor:pointer;
  padding:8px 12px 8px 6px; display:flex; align-items:center; transition:color var(--dur-2);
}
.p-comp-remove:hover { color:var(--red); }
.p-battle-none { font-size:11.5px; color:var(--muted2); font-style:italic; }
.p-battle-btn { padding:6px 12px; font-size:12px; white-space:nowrap; }

/* ══ Section label ══════════════════════════════════════════════════ */
.p-sectionlabel { margin-bottom:18px; }
.p-sectionlabel h2 { font-family:var(--font-display); font-size:var(--fz-subhead); font-weight:700; letter-spacing:-.022em; margin:0; }
.p-sectionlabel p { font-size:var(--fz-small); color:var(--muted); margin:4px 0 0; line-height:1.55; }

/* ══ Panels ═════════════════════════════════════════════════════════ */
/* Editorial panels: a hairline and generous internal space instead of a
   shadow. Elevation is reserved for things that genuinely float (drawer,
   dialog, tooltip); a panel that merely sits on the page does not need to
   pretend it is lifted off it. */
.p-panel {
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg);
  padding:26px; box-shadow:none; position:relative;
}
.p-panel-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; gap:12px; flex-wrap:wrap; }
.p-panel-title { font-size:var(--fz-lead); font-weight:660; letter-spacing:-.024em; margin:0; display:flex; align-items:center; gap:8px; }
.p-panel-sub { font-size:var(--fz-small); color:var(--muted); line-height:1.6; margin:-12px 0 16px; }
.p-badge { font-size:var(--fz-caption); font-weight:600; padding:2.4px 8px; border-radius:var(--r-lg); background:var(--surface2); color:var(--muted); border:1px solid var(--line); }
.p-badge.accent { background:var(--accent-soft); color:var(--accent); border-color:var(--accent-line); }
.p-badge.green { background:var(--green-soft); color:var(--green); border-color:transparent; }
.p-badge.amber { background:var(--amber-soft); color:var(--amber); border-color:transparent; }
.p-badge.red { background:var(--red-soft); color:var(--red); border-color:transparent; }

/* ══ Buttons ════════════════════════════════════════════════════════ */
/* Four levels, not two. Previously only primary and ghost existed, and a
   destructive action was .ghost.danger — a neutral bordered button that only
   turned red on hover, so "Remove competitor" and "Cancel" were visually
   identical until the pointer touched them, and identical forever on touch.

   .ghost is kept as an alias of .secondary because it is already on markup
   across every page; both resolve to the same treatment. */
.p-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:var(--s-2); font-family:inherit;
  font-size:13px; font-weight:600; letter-spacing:-.012em; padding:10px var(--s-4); border-radius:var(--r-sm);
  cursor:pointer; border:1px solid transparent; text-decoration:none; white-space:nowrap;
  transition:background var(--dur-2), border-color var(--dur-2), color var(--dur-2), box-shadow var(--dur-2), transform var(--dur-1);
}

/* 1 — Primary. Solid brand fill; one per view. */
.p-btn.primary { background:var(--accent); color:var(--on-accent); box-shadow:var(--sh-1); }
.p-btn.primary:hover { background:var(--accent-hover); box-shadow:var(--sh-2); transform:translateY(-1px); }
.p-btn.primary:active { background:var(--accent-active); transform:translateY(0); box-shadow:none; }

/* 2 — Secondary. A real alternative to the primary. */
.p-btn.ghost, .p-btn.secondary { background:var(--surface); border-color:var(--line); color:var(--text); box-shadow:var(--sh-1); }
.p-btn.ghost:hover, .p-btn.secondary:hover { border-color:var(--accent-line); color:var(--accent); background:var(--accent-soft); }
.p-btn.ghost:active, .p-btn.secondary:active { background:var(--surface3); transform:translateY(1px); box-shadow:none; }

/* 3 — Tertiary. Navigational, low stakes; no container. */
.p-btn.tertiary { background:none; border-color:transparent; color:var(--accent); box-shadow:none; padding-left:var(--s-2); padding-right:var(--s-2); }
.p-btn.tertiary:hover { background:var(--accent-soft); }
.p-btn.tertiary:active { background:var(--accent-line); }

/* 4 — Destructive. Legible as dangerous at rest, not only on hover. */
.p-btn.danger { background:var(--red-soft); border-color:var(--red-line); color:var(--red); box-shadow:none; }
.p-btn.danger:hover { background:var(--red); color:var(--on-accent); border-color:var(--red); }
.p-btn.danger:active { transform:translateY(1px); }

.p-btn:disabled { opacity:.45; cursor:not-allowed; filter:none; transform:none; box-shadow:none; }
.p-btn:disabled:hover { background:inherit; }

/* ══ KPI cards ══════════════════════════════════════════════════════ */
.p-kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(196px,1fr)); gap:14px; }
.p-kpi {
  position:relative; overflow:hidden; background:var(--surface); border:1px solid var(--line);
  border-radius:var(--r); padding:18px; box-shadow:var(--sh-1);
  transition:border-color var(--dur-3), box-shadow var(--dur-3);
}
.p-kpi::before {
  content:''; position:absolute; inset:0 0 auto 0; height:1px;
  background:linear-gradient(90deg,transparent,var(--hairline),transparent);
}
.p-kpi::after {
  content:''; position:absolute; width:130px; height:130px; right:-52px; top:-62px; border-radius:50%;
  background:radial-gradient(circle,var(--kpi-tint,var(--accent-glow)),transparent 68%);
  opacity:0; transition:opacity var(--dur-3) var(--ease-out); pointer-events:none;
}
.p-kpi:hover { border-color:var(--line-strong); box-shadow:var(--sh-3); }
.p-kpi:hover::after { opacity:.7; }
.p-kpi-top { display:flex; align-items:center; gap:10px; margin-bottom:15px; }
/* The icon chip carries the metric's DIMENSION colour as a solid fill. This is
   the fastest channel a reader has for telling traffic from keywords from
   backlinks in a grid of eight tiles — it is identity, not decoration. Locked
   metrics fall back to a neutral chip so absence stays quiet. */
.p-kpi-ico {
  width:32px; height:32px; border-radius:var(--r-sm); display:flex; align-items:center; justify-content:center;
  flex-shrink:0; background:var(--kpi-color,var(--accent)); color:#fff;
  box-shadow:0 2px 6px var(--kpi-shadow,transparent);
  transition:transform var(--dur-2) var(--ease-out);
}
.p-kpi.is-locked .p-kpi-ico { background:var(--surface3); color:var(--muted2); box-shadow:none; }
.p-kpi:hover .p-kpi-ico { transform:scale(1.06); }
.p-kpi-label { font-size:12px; font-weight:500; color:var(--muted); letter-spacing:-.008em; }
.p-kpi-mid { display:flex; align-items:flex-end; justify-content:space-between; gap:10px; }
.p-kpi-val { font-size:var(--fz-h1); font-weight:660; letter-spacing:-.038em; line-height:1.04; font-variant-numeric:tabular-nums; }
.p-kpi-spark { flex-shrink:0; opacity:.9; margin-bottom:2px; }
.p-spark { display:block; overflow:visible; }
.p-kpi-bottom { display:flex; align-items:center; gap:8px; margin-top:11px; min-height:19px; flex-wrap:wrap; }
.p-kpi-delta { font-size:11.5px; font-weight:660; padding:2px 8px; border-radius:var(--r-lg); display:inline-flex; align-items:center; gap:4px; font-variant-numeric:tabular-nums; }
.p-kpi-delta.good { color:var(--green); background:var(--green-soft); }
.p-kpi-delta.bad { color:var(--red); background:var(--red-soft); }
.p-kpi-hint { font-size:var(--fz-caption); color:var(--muted2); display:inline-flex; align-items:center; gap:4px; }
.p-kpi-na { font-size:26px; font-weight:660; color:var(--muted2); letter-spacing:-.038em; }
.p-kpi-lock { position:absolute; top:14px; right:14px; color:var(--muted2); opacity:.65; }

/* ══ Score ring ═════════════════════════════════════════════════════ */
.p-ring-wrap { position:relative; flex-shrink:0; }
.p-ring-wrap svg { transform:rotate(-90deg); width:100%; height:100%; display:block; }
.p-ring-track { fill:none; stroke:var(--surface3); }
.p-ring-val { fill:none; stroke-linecap:round; }
.p-ring-num { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.p-ring-num b { font-weight:700; letter-spacing:-.04em; line-height:1; font-variant-numeric:tabular-nums; }
.p-ring-num span { font-size:9.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; margin-top:5px; font-weight:600; }

/* Sources that have nothing to report yet. One quiet line rather than a row of
   placeholder cards competing with real measurements for attention. */
.p-score-pending {
  display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:12px;
  padding:11px 16px; border:1px dashed var(--line-strong); border-radius:var(--r);
  background:var(--surface2); font-size:12.5px; color:var(--muted); line-height:1.5;
}
.p-score-pending svg { color:var(--muted2); flex-shrink:0; }
.p-score-pending-lead { font-weight:660; color:var(--text2); letter-spacing:-.01em; }
.p-score-pending-item { display:inline-flex; gap:5px; }
.p-score-pending-item::before { content:"·"; color:var(--line-strong); }
.p-score-pending-item b { font-weight:600; color:var(--text2); }

/* ══ Score cards ════════════════════════════════════════════════════ */
.p-score-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(172px,1fr)); gap:14px; }
.p-score-card {
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r);
  padding:22px 16px 20px; text-align:center; box-shadow:var(--sh-1);
  display:flex; flex-direction:column; align-items:center; transition:border-color var(--dur-3), box-shadow var(--dur-3);
}
.p-score-card:hover { border-color:var(--line-strong); box-shadow:var(--sh-2); }
.p-score-card .p-ring-wrap { margin:0 auto 12px; }
.p-score-card .p-ring-num span { display:none; }
.p-score-label { font-size:var(--fz-small); font-weight:600; color:var(--text2); letter-spacing:-.014em; }
.p-score-locked { color:var(--muted2); font-size:10.5px; margin-top:6px; display:flex; align-items:center; justify-content:center; gap:4px; line-height:1.45; }

/* ══ Onboarding (was "not connected") ═══════════════════════════════ */
.p-onboard {
  position:relative; overflow:hidden; background:var(--surface); border:1px solid var(--line);
  border-radius:var(--r-lg); padding:22px; box-shadow:var(--sh-1);
  display:flex; flex-direction:column; gap:12px; transition:border-color var(--dur-3), box-shadow var(--dur-3);
}
.p-onboard::after {
  content:''; position:absolute; width:180px; height:180px; right:-70px; top:-88px; border-radius:50%;
  background:radial-gradient(circle,var(--accent-glow),transparent 70%); opacity:.5; transition:opacity var(--dur-3);
}
.p-onboard:hover { border-color:var(--accent-line); box-shadow:var(--sh-3); }
.p-onboard:hover::after { opacity:.9; }
.p-onboard-top { position:relative; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.p-onboard-ico {
  width:44px; height:44px; border-radius:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
  background:var(--accent); color:var(--on-accent);
  box-shadow:0 6px 18px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.3);
}
.p-onboard-tag { font-size:10px; font-weight:660; letter-spacing:.07em; text-transform:uppercase; color:var(--accent); background:var(--accent-soft); border:1px solid var(--accent-line); padding:3.4px 8px; border-radius:var(--r-lg); white-space:nowrap; }
.p-onboard-title { position:relative; font-size:var(--fz-lead); font-weight:660; margin:0; letter-spacing:-.024em; }
.p-onboard-desc { position:relative; font-size:var(--fz-small); color:var(--muted); line-height:1.65; margin:0; }
.p-onboard-list { position:relative; list-style:none; margin:2px 0 0; padding:0; display:flex; flex-direction:column; gap:8px; }
.p-onboard-list li { display:flex; align-items:flex-start; gap:8px; font-size:var(--fz-small); color:var(--text2); line-height:1.5; }
.p-onboard-list svg { color:var(--green); flex-shrink:0; margin-top:2px; }
.p-onboard-foot { position:relative; display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:4px; flex-wrap:wrap; }
.p-onboard-note { font-size:11.5px; color:var(--muted2); line-height:1.5; }
/* A card that still needs something is not "Available". The tag now reflects
   which state the card is in rather than always claiming availability. */
.p-onboard-tag.pending { color:var(--muted); background:var(--surface2); border-color:var(--line); }
/* What is required before this capability exists. Present on every card that
   has no CTA, which is what makes a dead-end card impossible. */
.p-onboard-req { display:flex; gap:8px; align-items:flex-start; margin-top:12px; padding:10px 12px; background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r-sm); font-size:11.5px; color:var(--muted); line-height:1.55; }
.p-onboard-req svg { flex-shrink:0; margin-top:1px; color:var(--muted2); }

/* ══ Empty states ═══════════════════════════════════════════════════ */
.p-empty {
  position:relative; overflow:hidden; border:1px solid var(--line); border-radius:var(--r-lg);
  padding:46px 26px; text-align:center; background:var(--mesh), var(--surface2);
}
.p-empty-icon {
  width:54px; height:54px; margin:0 auto 16px; border-radius:var(--r); display:flex; align-items:center; justify-content:center;
  background:var(--surface); border:1px solid var(--line); color:var(--accent); font-size:21px;
  box-shadow:var(--sh-2), inset 0 1px 0 var(--hairline);
}
.p-empty-title { font-family:var(--font-display); font-size:var(--fz-subhead); font-weight:700; color:var(--text); margin-bottom:9px; letter-spacing:-.022em; }
.p-empty-sub { font-size:13px; color:var(--muted); max-width:380px; margin:0 auto; line-height:1.66; }

/* ══ Priorities ═════════════════════════════════════════════════════ */
.p-priority-list { display:flex; flex-direction:column; gap:8px; }
.p-priority {
  display:flex; align-items:flex-start; gap:12px; padding:14px 16px;
  background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r-sm);
  transition:background var(--dur-2), border-color var(--dur-2), transform var(--dur-2);
}
.p-priority-link { text-decoration:none; color:inherit; }
.p-priority-link:hover { background:var(--surface); border-color:var(--accent-line); transform:translateX(3px); box-shadow:var(--sh-1); }
.p-priority-dot { width:8px; height:8px; border-radius:50%; margin-top:5.5px; flex-shrink:0; }
.p-priority-text { font-size:var(--fz-body); font-weight:500; line-height:1.45; letter-spacing:-.012em; }
.p-priority-sub { font-size:12px; color:var(--muted); margin-top:3px; line-height:1.5; }
.p-priority-arrow { color:var(--muted2); flex-shrink:0; align-self:center; transition:transform var(--dur-2), color var(--dur-2); }
.p-priority-link:hover .p-priority-arrow { color:var(--accent); transform:translateX(2px); }

/* ══ Feed ═══════════════════════════════════════════════════════════ */
.p-feed { display:flex; flex-direction:column; }
.p-feed-item { display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-bottom:1px solid var(--line-soft); }
.p-feed-item:last-child { border-bottom:0; padding-bottom:0; }
.p-feed-item:first-child { padding-top:0; }
.p-feed-icon { width:29px; height:29px; border-radius:var(--r-xs); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px; border:1px solid var(--line-soft); }
.p-feed-title { font-size:13px; font-weight:500; line-height:1.45; letter-spacing:-.01em; }
.p-feed-meta { font-size:11.5px; color:var(--muted); margin-top:2.5px; }

/* ══ AI summary ═════════════════════════════════════════════════════ */
.p-exec {
  position:relative; overflow:hidden; border:1px solid var(--system-line); border-radius:var(--r-lg);
  padding:22px 24px; display:flex; gap:16px; align-items:flex-start;
  background:var(--mesh), var(--surface);
  box-shadow:var(--sh-2);
}
.p-exec-icon {
  width:36px; height:36px; border-radius:var(--r-sm); flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:var(--system); color:var(--on-system);
}
.p-exec-label { font-size:10.5px; font-weight:660; letter-spacing:.09em; text-transform:uppercase; color:var(--system); margin-bottom:7px; }
.p-exec-text { font-size:14px; line-height:1.72; color:var(--text2); margin:0; }

/* ══ Tables ═════════════════════════════════════════════════════════ */
.p-table { width:100%; border-collapse:collapse; }
.p-table th { text-align:left; font-size:var(--fz-caption); font-weight:600; letter-spacing:.03em; color:var(--muted); padding:0 12px 12px; border-bottom:1px solid var(--line); white-space:nowrap; }
.p-table td { padding:12px 12px; font-size:13px; border-bottom:1px solid var(--line-soft); color:var(--text2); }
.p-table tbody tr:last-child td { border-bottom:0; }
.p-table tbody tr { transition:background var(--dur-1); }
.p-table tbody tr:hover td { background:var(--surface2); }
/* .rt-scroll shares this bleed-to-panel-edge treatment; .rt-stack opts out
   below sm, where cards should sit inside the panel padding (Phase 3). */
.p-table-wrap, .rt-scroll { overflow-x:auto; margin:0 -22px; padding:0 22px; }
.p-table-sort { background:none; border:0; font:inherit; font-size:var(--fz-caption); font-weight:600; letter-spacing:.03em; color:var(--muted); cursor:pointer; padding:0; display:inline-flex; align-items:center; gap:4px; transition:color var(--dur-2); }
.p-table-sort:hover { color:var(--text); }
.p-table-sort.on { color:var(--accent); }
.p-kwcell { font-weight:600; color:var(--text); max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:-.012em; }
/* Rank bands. The single most product-specific colour decision in the app:
   a reader should know how a keyword is doing before reading the number.
   Top 3 = positive, page 1 = brand blue, page 2 = attention, beyond = neutral.
   The number is always present, so rank is never conveyed by colour alone. */
.p-pos { display:inline-flex; min-width:31px; justify-content:center; font-size:11.5px; font-weight:660; padding:4px 8px; border-radius:var(--r-xs); background:var(--surface3); color:var(--muted); font-variant-numeric:tabular-nums; border:1px solid transparent; }
.p-pos.top3 { background:var(--green-soft); color:var(--green); border-color:var(--green-line); }
.p-pos.top10 { background:var(--accent-soft); color:var(--accent); border-color:var(--accent-line); }
.p-pos.top20 { background:var(--amber-soft); color:var(--amber); border-color:var(--amber-line); }
.p-chip { font-size:var(--fz-caption); font-weight:500; padding:2.4px 8px; border-radius:var(--r-xs); background:var(--surface2); color:var(--muted); border:1px solid var(--line-soft); text-transform:capitalize; white-space:nowrap; }
.p-na { color:var(--muted2); }

/* ══ Inputs ═════════════════════════════════════════════════════════ */
.p-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:17px; }
.p-input { background:var(--surface); border:1px solid var(--line); color:var(--text); padding:9.4px 12px; border-radius:var(--r-sm); font-family:inherit; font-size:13px; min-width:200px; flex:1; box-shadow:var(--sh-1); transition:border-color var(--dur-2), box-shadow var(--dur-2); }
.p-input::placeholder { color:var(--muted2); }
.p-input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3.5px var(--accent-soft); }
.p-select { background:var(--surface); border:1px solid var(--line); color:var(--text); padding:9.4px 12px; border-radius:var(--r-sm); font-family:inherit; font-size:13px; cursor:pointer; box-shadow:var(--sh-1); }
.p-select:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3.5px var(--accent-soft); }
.p-pager { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; font-size:var(--fz-small); color:var(--muted); flex-wrap:wrap; }
.p-pager-btns { display:flex; gap:8px; }
.p-pager-btn { background:var(--surface); border:1px solid var(--line); color:var(--text); padding:7.4px 14px; border-radius:var(--r-sm); font-family:inherit; font-size:var(--fz-small); cursor:pointer; box-shadow:var(--sh-1); transition:all var(--dur-2) var(--ease-out); }
.p-pager-btn:disabled { opacity:.4; cursor:not-allowed; }
.p-pager-btn:not(:disabled):hover { border-color:var(--accent); color:var(--accent); }

/* ══ Sub nav ════════════════════════════════════════════════════════ */
.p-subnav { display:flex; gap:4px; overflow-x:auto; padding:4px; background:var(--sunken); border:1px solid var(--line); border-radius:13px; margin-bottom:24px; }
.p-subnav::-webkit-scrollbar { height:0; }
.p-subnav-btn { position:relative; display:inline-flex; align-items:center; gap:8px; background:transparent; border:0; color:var(--muted); padding:8.4px 16px; border-radius:var(--r-sm); font-family:inherit; font-size:13px; font-weight:500; cursor:pointer; white-space:nowrap; transition:color var(--dur-2); }
.p-subnav-btn:hover { color:var(--text); }
.p-subnav-btn.on { color:var(--text); font-weight:600; }
.p-subnav-hl { position:absolute; inset:0; background:var(--surface); border-radius:var(--r-sm); box-shadow:var(--sh-2); z-index:0; }
.p-subnav-inner { position:relative; z-index:1; display:inline-flex; align-items:center; gap:8px; }
.p-subnav-count { font-size:10.5px; font-weight:660; background:var(--surface3); color:var(--muted); padding:1px 6px; border-radius:var(--r-lg); font-variant-numeric:tabular-nums; }
.p-subnav-btn.on .p-subnav-count { background:var(--accent-soft); color:var(--accent); }

/* ══ Stat tiles ═════════════════════════════════════════════════════ */
.p-stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(136px,1fr)); gap:12px; }
.p-stattile { background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r-sm); padding:16px; transition:border-color var(--dur-2), background var(--dur-2), transform var(--dur-2); }
.p-stattile:hover { border-color:var(--line); background:var(--surface); transform:translateY(-1px); }
.p-stattile-val { font-size:var(--fz-h2); font-weight:660; letter-spacing:-.034em; line-height:1.14; font-variant-numeric:tabular-nums; }
.p-stattile-label { font-size:11.5px; color:var(--muted); margin-top:5px; font-weight:500; }
.p-stattile-sub { font-size:10.5px; color:var(--muted2); margin-top:3px; }

/* ══ Movement ═══════════════════════════════════════════════════════ */
.p-move-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 0; border-bottom:1px solid var(--line-soft); }
.p-move-row:last-child { border-bottom:0; padding-bottom:0; }
.p-move-row:first-child { padding-top:0; }
.p-move-kw { font-size:13px; font-weight:500; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:-.01em; }
.p-move-delta { font-size:11.5px; font-weight:660; display:inline-flex; align-items:center; gap:4px; padding:2.4px 8px; border-radius:var(--r-lg); flex-shrink:0; font-variant-numeric:tabular-nums; }
.p-move-delta.up { color:var(--green); background:var(--green-soft); }
.p-move-delta.down { color:var(--red); background:var(--red-soft); }
.p-move-delta.flat { color:var(--muted); background:var(--surface3); }

/* ══ Recommendations ════════════════════════════════════════════════ */
.p-rec-list { display:flex; flex-direction:column; gap:12px; }
.p-rec { background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r); padding:18px; transition:border-color var(--dur-2), background var(--dur-2); }
.p-rec:hover { border-color:var(--accent-line); background:var(--surface); }
.p-rec-top { display:flex; align-items:flex-start; gap:12px; margin-bottom:10px; }
.p-rec-icon { width:30px; height:30px; border-radius:var(--r-xs); background:var(--accent-soft); color:var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid var(--accent-line); }
.p-rec-title { font-size:var(--fz-body); font-weight:600; line-height:1.4; letter-spacing:-.018em; }
.p-rec-text { font-size:var(--fz-small); color:var(--muted); line-height:1.68; margin:0 0 14px; }
.p-rec-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.p-rec-impact { font-size:11.5px; font-weight:600; color:var(--green); }

/* ══ Approvals ══════════════════════════════════════════════════════ */
.p-approve { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg); padding:20px; box-shadow:var(--sh-1); transition:border-color var(--dur-2), box-shadow var(--dur-2); }
.p-approve:hover { border-color:var(--line-strong); box-shadow:var(--sh-2); }
.p-approve-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:13px; }
.p-approve-title { font-size:var(--fz-lead); font-weight:660; margin:8px 0 0; line-height:1.4; letter-spacing:-.022em; }
.p-approve-meta { font-size:12px; color:var(--muted); margin-top:7px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.p-approve-body { background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r-sm); padding:16px; font-size:13px; line-height:1.72; color:var(--text2); white-space:pre-wrap; word-break:break-word; }
.p-approve-more { background:none; border:0; color:var(--accent); font-family:inherit; font-size:var(--fz-small); font-weight:600; cursor:pointer; padding:10px 0 0; }
.p-approve-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:16px; flex-wrap:wrap; }
.p-approve-actions { display:flex; gap:8px; margin-left:auto; }
.p-approve-done { display:flex; align-items:center; gap:12px; padding:16px 20px; }
.p-approve-donetitle { font-size:13px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.p-cardlist { display:flex; flex-direction:column; gap:12px; }
.p-review-quote { background:var(--surface2); border-left:2.5px solid var(--accent-line); border-radius:0 var(--r-sm) var(--r-sm) 0; padding:12px 16px; font-size:var(--fz-small); line-height:1.68; color:var(--muted); font-style:italic; margin-bottom:14px; }
.p-reply-label { font-size:10.5px; font-weight:660; letter-spacing:.08em; text-transform:uppercase; color:var(--accent); margin-bottom:8px; }
.p-stars { color:var(--amber); font-size:12px; letter-spacing:1.5px; }

/* ══ Chart tooltip ══════════════════════════════════════════════════ */
.p-tip { background:var(--overlay); backdrop-filter:blur(14px) saturate(180%); -webkit-backdrop-filter:blur(14px) saturate(180%); border:1px solid var(--line); border-radius:var(--r-sm); box-shadow:var(--sh-4); padding:12px 12px; min-width:132px; }
.p-tip-label { font-size:10.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--muted2); margin-bottom:8px; }
.p-tip-row { display:flex; align-items:center; justify-content:space-between; gap:16px; font-size:var(--fz-small); padding:2.4px 0; }
.p-tip-key { display:flex; align-items:center; gap:8px; color:var(--muted); }
.p-tip-dot { width:7px; height:7px; border-radius:2.5px; flex-shrink:0; }
.p-tip-val { font-weight:660; color:var(--text); font-variant-numeric:tabular-nums; }

/* ══ Skeletons ══════════════════════════════════════════════════════ */
.p-skel { background:linear-gradient(90deg,var(--surface2) 25%,var(--surface3) 50%,var(--surface2) 75%); background-size:200% 100%; border-radius:var(--r); animation:pShimmer 1.7s ease-in-out infinite; }

/* ══ Layout ═════════════════════════════════════════════════════════ */
.p-2col { display:grid; grid-template-columns:1.4fr 1fr; gap:28px; align-items:start; }
${down.md} { .p-2col { grid-template-columns:1fr; } }
.p-stack { display:flex; flex-direction:column; gap:24px; min-width:0; }
.p-home { display:flex; flex-direction:column; gap:30px; }
.p-subgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(268px,1fr)); gap:16px; }
.p-site-card { display:flex; align-items:center; justify-content:space-between; text-decoration:none; color:var(--text); font-weight:600; font-size:13px; padding:18px 20px; letter-spacing:-.014em; transition:border-color var(--dur-2), color var(--dur-2); }
.p-site-card:hover { border-color:var(--accent-line); color:var(--accent); }
.p-ministat-row { display:flex; gap:12px; }
.p-ministat { flex:1; text-align:center; background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r-sm); padding:16px 8px; }
.p-ministat-n { font-size:23px; font-weight:660; letter-spacing:-.034em; font-variant-numeric:tabular-nums; }
.p-ministat-label { font-size:11.5px; color:var(--muted); margin-top:4px; }

/* ══ Settings ═══════════════════════════════════════════════════════ */
.p-deflist { margin:0; display:flex; flex-direction:column; }
.p-def { display:flex; gap:18px; padding:16px 0; border-bottom:1px solid var(--line-soft); flex-wrap:wrap; }
.p-def:last-child { border-bottom:0; padding-bottom:0; }
.p-def:first-child { padding-top:0; }
.p-def dt { font-size:var(--fz-small); color:var(--muted); font-weight:500; min-width:162px; }
.p-def dd { margin:0; font-size:var(--fz-body); flex:1; min-width:200px; word-break:break-word; color:var(--text2); }
.p-conn-list { display:flex; flex-direction:column; }
.p-conn { display:flex; align-items:flex-start; gap:14px; padding:18px 0; border-bottom:1px solid var(--line-soft); flex-wrap:wrap; }
.p-conn:last-child { border-bottom:0; padding-bottom:0; }
.p-conn:first-child { padding-top:0; }
.p-conn-dot { width:32px; height:32px; border-radius:var(--r-sm); display:flex; align-items:center; justify-content:center; background:var(--surface2); color:var(--muted2); flex-shrink:0; border:1px solid var(--line-soft); }
.p-conn-dot.on { background:var(--green-soft); color:var(--green); border-color:transparent; }
.p-conn-name { font-size:var(--fz-body); font-weight:600; letter-spacing:-.018em; }
.p-conn-desc { font-size:var(--fz-small); color:var(--muted); margin-top:3px; line-height:1.6; }
.p-conn-detail { display:inline-block; margin-top:8px; font-family:var(--font-mono); font-size:10.5px; background:var(--surface2); border:1px solid var(--line-soft); padding:2.4px 8px; border-radius:var(--r-xs); color:var(--muted); }
/* Integration Center. Every connection states WHY it is in its current state,
   so .p-conn-why is not optional decoration -- it is the row's explanation. */
.p-conn-why { font-size:var(--fz-small); color:var(--text); margin-top:7px; line-height:1.6; }
.p-conn-meta { font-size:11.5px; color:var(--muted2); margin-top:6px; font-variant-numeric:tabular-nums; }
/* The connected account, shown as a person recognises their website rather
   than as the provider's internal identifier. */
.p-conn-account { display:inline-block; margin-top:8px; font-size:12px; font-weight:600; color:var(--text); }
.p-conn-note { display:flex; gap:8px; align-items:flex-start; margin-top:9px; padding:9px 11px; background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r-sm); font-size:12px; color:var(--muted); line-height:1.55; }
.p-conn-note.error { background:var(--red-soft); border-color:transparent; color:var(--red); }
.p-conn-note svg { flex-shrink:0; margin-top:1px; }
.p-conn-pick { margin-top:10px; max-width:380px; }
.p-conn-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.p-inline-link { color:var(--accent); text-decoration:none; white-space:nowrap; }
.p-inline-link:hover { text-decoration:underline; }
.p-linkbtn { background:none; border:0; padding:0; font:inherit; color:var(--accent); cursor:pointer; text-decoration:underline; min-height:var(--touch); }
/* Legacy pairing, kept working: .ghost.danger now resolves to the same
   resting destructive treatment as .danger rather than a neutral button. */
.p-btn.ghost.danger { background:var(--red-soft); border-color:var(--red-line); color:var(--red); }
.p-btn.ghost.danger:hover { background:var(--red); color:var(--on-accent); border-color:var(--red); }

/* ══ Assistant ══════════════════════════════════════════════════════ */
.p-assistant-page { height:calc(100vh - 190px); min-height:540px; }
.p-chat { flex:1; display:flex; flex-direction:column; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-xl); box-shadow:var(--sh-2); overflow:hidden; min-height:0; }
.p-chat-scroll { flex:1; overflow-y:auto; padding:28px; display:flex; flex-direction:column; gap:18px; }
.p-chat-welcome { margin:auto; text-align:center; max-width:560px; padding:20px 0; }
/* The assistant is the machine, so its marks are azure. The USER's own bubble
   below stays brand graphite — the two speakers are now told apart by more
   than position. */
.p-chat-welcome-icon { width:54px; height:54px; margin:0 auto 18px; border-radius:17px; display:flex; align-items:center; justify-content:center; background:var(--system); color:var(--on-system); }
.p-chat-welcome-title { font-size:var(--fz-h2); font-weight:660; margin:0 0 8px; letter-spacing:-.03em; }
.p-chat-welcome-sub { font-size:var(--fz-body); color:var(--muted); line-height:1.68; margin:0 0 24px; }
.p-chat-suggestions { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
.p-chat-suggestion { background:var(--surface); border:1px solid var(--line); color:var(--text2); padding:9.4px 16px; border-radius:var(--r-lg); font-family:inherit; font-size:var(--fz-small); cursor:pointer; text-align:left; box-shadow:var(--sh-1); transition:border-color var(--dur-2), color var(--dur-2), transform var(--dur-2); }
.p-chat-suggestion:hover { border-color:var(--accent-line); color:var(--accent); transform:translateY(-1px); }
.p-msg { display:flex; gap:12px; align-items:flex-start; }
.p-msg.user { justify-content:flex-end; }
.p-msg-avatar { width:30px; height:30px; border-radius:var(--r-sm); background:var(--system); color:var(--on-system); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
.p-msg-bubble { max-width:min(680px,80%); padding:14px 16px; border-radius:var(--r); font-size:var(--fz-body); line-height:1.72; white-space:pre-wrap; word-break:break-word; }
.p-msg.assistant .p-msg-bubble { background:var(--surface2); border:1px solid var(--line-soft); border-top-left-radius:5px; color:var(--text2); }
.p-msg.user .p-msg-bubble { background:var(--accent); color:var(--on-accent); border-top-right-radius:5px; }
.p-msg-typing { display:flex; gap:4px; align-items:center; padding:16px; }
.p-msg-typing span { width:6px; height:6px; border-radius:50%; background:var(--muted2); animation:pPulse 1.2s infinite; }
.p-msg-typing span:nth-child(2) { animation-delay:.18s; }
.p-msg-typing span:nth-child(3) { animation-delay:.36s; }
.p-chat-error { font-size:var(--fz-small); color:var(--red); background:var(--red-soft); padding:12px 16px; border-radius:var(--r-sm); }
.p-chat-input-row { display:flex; gap:10px; padding:16px; border-top:1px solid var(--line-soft); background:var(--surface); }
${down.md} { .p-assistant-page { height:calc(100vh - 150px); } .p-msg-bubble { max-width:88%; } }

/* ══ Report ═════════════════════════════════════════════════════════ */
.p-report { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-xl); padding:38px; box-shadow:var(--sh-1); }
.p-report-head { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; border-bottom:1px solid var(--line-strong); padding-bottom:24px; margin-bottom:28px; flex-wrap:wrap; }
.p-report-title { font-family:var(--font-display); font-size:var(--fz-title); font-weight:var(--fw-display); margin:0 0 8px; letter-spacing:var(--tr-display); line-height:var(--lh-display); }
.p-report-period { font-size:var(--fz-small); color:var(--muted); }
.p-report-section { margin-bottom:30px; }
.p-report-section h3 { font-size:var(--fz-caption); font-weight:660; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:0 0 14px; }
@media print {
  .p-side, .p-topbar, .p-scrim, .p-pagehead, .p-subnav, .p-preview, .p-no-print { display:none !important; }
  .p-main { padding:0 !important; max-width:none !important; }
  .portal { background:#fff !important; }
  .p-report { border:0; box-shadow:none; padding:0; }
  .p-report-section { break-inside:avoid; }
}

/* Reduced motion is handled globally in lib/ui/tokens.ts GLOBAL_CSS, which
   applies to every element on the page — a portal-scoped copy would be a
   second declaration of the same rule. */

/* ══ Agent activity ═════════════════════════════════════════════════
   The platform showing its own work. Monospace timings and tabular figures,
   because this is machine output and it should read as an instrument, not as
   prose. State is carried by dot colour AND an icon AND a word, so it never
   depends on colour alone.

   Azure appears on exactly one state — running — because that is the moment
   the machine is acting. Done is positive, failed is critical, queued is
   neutral. This is the discipline that keeps azure meaningful. */
.p-act-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; }
.p-act-row {
  display:flex; align-items:flex-start; gap:12px; padding:11px 0;
  border-bottom:1px solid var(--line-soft);
}
.p-act-row:last-child { border-bottom:0; padding-bottom:0; }
.p-act-row:first-child { padding-top:0; }
.p-act-dot {
  width:7px; height:7px; border-radius:50%; flex-shrink:0; margin-top:6px;
  background:var(--line-strong);
}
.p-act-row.is-on .p-act-dot { background:var(--system); box-shadow:0 0 0 3px var(--system-soft); }
.p-act-row.is-done .p-act-dot { background:var(--green); }
.p-act-row.is-failed .p-act-dot { background:var(--red); }
.p-act-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.p-act-title { font-size:var(--fz-body); font-weight:500; letter-spacing:-.012em; line-height:1.4; }
.p-act-error {
  font-family:var(--font-mono); font-size:11px; color:var(--red); line-height:1.5;
  overflow-wrap:anywhere;
}
.p-act-meta { display:flex; flex-direction:column; align-items:flex-end; gap:3px; flex-shrink:0; text-align:right; }
.p-act-state {
  display:inline-flex; align-items:center; gap:5px;
  font-size:11px; font-weight:600; letter-spacing:.02em; color:var(--muted);
}
.p-act-row.is-on .p-act-state { color:var(--system); }
.p-act-row.is-done .p-act-state { color:var(--green); }
.p-act-row.is-failed .p-act-state { color:var(--red); }
.p-act-time {
  font-family:var(--font-mono); font-size:10.5px; color:var(--muted2);
  font-variant-numeric:tabular-nums; white-space:nowrap;
}
${down.sm} {
  .p-act-meta { align-items:flex-start; text-align:left; }
  .p-act-row { flex-wrap:wrap; }
}

/* ── Live system status, in the shell ──
   A persistent, honest read on whether the platform is working right now.
   Hidden entirely when idle rather than saying "idle" — an always-on badge
   becomes furniture and stops being read. */
.p-live {
  display:inline-flex; align-items:center; gap:7px; padding:4px 10px;
  border-radius:var(--radius-full); border:1px solid var(--system-line);
  background:var(--system-soft); color:var(--system);
  font-size:11px; font-weight:600; letter-spacing:.01em; white-space:nowrap;
}
.p-live i {
  width:6px; height:6px; border-radius:50%; background:var(--system); flex-shrink:0;
  animation:pPulse 2.4s ease-in-out infinite;
}
.p-live-count { font-variant-numeric:tabular-nums; }

/* ── AI provenance ──
   Marks content the platform produced itself. Deliberately small and quiet:
   its job is honest attribution, not celebration. */
.p-by-ai {
  display:inline-flex; align-items:center; gap:4px;
  font-size:10.5px; font-weight:600; letter-spacing:.04em;
  color:var(--system); background:var(--system-soft);
  border:1px solid var(--system-line); border-radius:var(--radius-xs);
  padding:2px 7px; white-space:nowrap;
}

/* ══ Press states ═══════════════════════════════════════════════════
   Hover was well covered; :active was almost entirely absent, so nothing in
   the product felt like it was being pressed. A control that acknowledges the
   press is the cheapest perceived-responsiveness win available, and it is the
   only feedback a touch user gets at all — they never hover.

   Kept to transform + background so nothing reflows, and deliberately on the
   fast duration: a press must feel immediate, not eased. */
.portal .p-quick:active,
.portal .p-chat-suggestion:active,
.portal .p-cap-run:active:not(:disabled),
.portal .p-cap-link:active,
.portal .p-pager-btn:not(:disabled):active,
.portal .p-icon-btn:active,
.portal .p-signout-btn:active,
.portal .p-comp-main:active,
.portal .p-opp-head:active,
.portal .p-subnav-btn:active,
.portal .p-priority-link:active,
.portal .p-ai-signal-link:active {
  transform:translateY(1px) scale(.995);
  transition-duration:var(--dur-1);
}
.portal .p-bnav-item:active .p-bnav-ico { transform:scale(.92); transition:transform var(--dur-1) var(--ease-out); }
.portal .p-nav-item:active { transform:translateX(1px); }

/* ══ Numbers ════════════════════════════════════════════════════════
   Every numeric value in the portal resolves to one treatment. Before this the
   same figure appeared at four sizes and two weights depending only on which
   component it landed in. */
.portal .p-kpi-val,
.portal .p-stattile-val,
.portal .p-ministat-n,
.portal .p-ai-count,
.portal .p-mission-cell-val,
.portal .p-ring-num b,
.portal .p-kpi-delta,
.portal .p-move-delta,
.portal .p-pos,
.portal .p-quick-count,
.portal .p-subnav-count,
.portal .p-opp-chip,
.portal .p-conn-meta,
.portal .p-tip-val {
  font-variant-numeric:tabular-nums;
  font-feature-settings:'tnum' 1;
}
.portal .p-kpi-val { font-size:34px; font-weight:700; letter-spacing:-.038em; }
.portal .p-ai-count { font-size:var(--fz-metric-md); letter-spacing:var(--num-spacing); }
.portal .p-stattile-val,
.portal .p-ministat-n,
.portal .p-mission-cell-val { font-size:var(--fz-metric-md); letter-spacing:var(--num-spacing); }

/* ══ Phase 1 foundation ═════════════════════════════════════════════ */
${touchTargetCSS(".portal")}

/* The sub-nav already scrolled horizontally but gave no sign that it did, so
   offscreen tabs read as missing rather than scrollable. A right-edge fade
   makes the overflow visible, and scroll-snap makes it land cleanly. */
.p-subnav {
  overscroll-behavior-x:contain; -webkit-overflow-scrolling:touch;
  scroll-snap-type:x proximity; scrollbar-width:none;
  -webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 26px),transparent);
          mask-image:linear-gradient(90deg,#000 calc(100% - 26px),transparent);
}
.p-subnav::-webkit-scrollbar { display:none; }
.p-subnav-btn { scroll-snap-align:start; }
/* Toolbar fields grow to fill the row; the input keeps its own visual class. */
.p-toolbar-grow { flex:1; min-width:180px; }

/* ══ Phase 4: shared form fields + loading ══════════════════════════ */
${fieldCSS(".portal", {
  surface: "var(--surface)", line: "var(--line)", lineStrong: "var(--line-strong)",
  muted: "var(--muted)", text: "var(--text)", accent: "var(--accent)",
  danger: "var(--red)", radius: "var(--r-sm)",
})}

/* ══ Phase 3: card-stack tables ═════════════════════════════════════ */
${responsiveTableCSS(".portal", {
  surface: "var(--surface)", line: "var(--line-soft)", muted: "var(--muted)",
  text: "var(--text)", radius: "var(--r-sm)",
})}


/* ══ Phase 2: bottom navigation ═════════════════════════════════════ */
/* Hidden by default so it costs desktop nothing; shown only below md, where
   the sidebar has been replaced by the drawer. */
.p-bnav { display:none; }

${down.md} {
  .p-bnav {
    display:grid; grid-template-columns:repeat(5,1fr);
    position:fixed; left:0; right:0; bottom:0; z-index:180;
    padding:6px 4px calc(6px + env(safe-area-inset-bottom));
    background:var(--glass);
    backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px);
    border-top:1px solid var(--line);
  }
  .p-bnav-item {
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px;
    padding:8px 2px 4px; border:0; background:none; cursor:pointer;
    font-family:inherit; color:var(--muted2); text-decoration:none;
    -webkit-tap-highlight-color:transparent;
    transition:color var(--dur-2) var(--ease-out);
  }
  .p-bnav-item:hover { color:var(--text2); }
  .p-bnav-item.on { color:var(--accent); }
  .p-bnav-ico {
    position:relative; display:flex; align-items:center; justify-content:center;
    width:44px; height:27px; border-radius:var(--r-xs);
  }
  .p-bnav-ico > svg { position:relative; z-index:1; }
  .p-bnav-pill {
    position:absolute; inset:0; border-radius:var(--r-xs); z-index:0;
    background:var(--accent-soft); border:1px solid var(--accent-line);
  }
  .p-bnav-label { font-size:10.5px; font-weight:600; letter-spacing:-.005em; line-height:1; }

  /* The drawer sits above the bottom bar rather than behind it. */
  .p-side-mobile { z-index:200; }
  .p-scrim { z-index:190; }
}

/* Printing a report should never include navigation chrome. */
@media print { .p-bnav { display:none !important; } }
`;

function darkVars() {
  return `
  /* Dark is SELECTED, not inverted: its own steps, on a cool navy-slate ground
     that suits a data product rather than a neutral charcoal. */
  --bg:#080B11; --bg-2:#0B0F16;
  --sunken:#0B0F16; --surface:#111721; --surface2:#171E2A; --surface3:#1F2733;
  --raised:#161D28; --overlay:rgba(17,23,33,.88);
  --line:#232C3A; --line-soft:#1B2330; --line-strong:#33404F;
  --hairline:rgba(255,255,255,.06);
  --text:#F2F5F9; --text2:#B4BECD; --muted:#8F9AAA; --muted2:#8A95A5;
  ${semanticVars("dark")}
  --accent2:${MESH_DARK.a2}; --accent3:${MESH_DARK.a3};
  --sh-1:0 1px 2px rgba(0,0,0,.36);
  --sh-2:0 2px 6px rgba(0,0,0,.4), 0 8px 22px rgba(0,0,0,.32);
  --sh-3:0 10px 32px rgba(0,0,0,.5), 0 3px 8px rgba(0,0,0,.35);
  --sh-4:0 24px 64px rgba(0,0,0,.62), 0 8px 20px rgba(0,0,0,.4);
  --sh-glow:0 0 0 1px var(--accent-line), 0 14px 38px var(--accent-glow);
  --glass:rgba(16,18,24,.72);
  --mesh:
    radial-gradient(80% 120% at 12% 0%, var(--accent2), transparent 55%),
    radial-gradient(90% 130% at 60% 100%, var(--accent3), transparent 62%);
  color-scheme: dark;`;
}
