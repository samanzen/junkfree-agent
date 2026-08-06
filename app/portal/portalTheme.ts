// Design system for the customer Portal. Everything is scoped under .portal so
// it can never bleed into or be affected by the admin dashboard's own styles
// (app/dashboard/page.tsx), which is untouched.
//
// Theme: CSS custom properties on .portal, overridden by [data-theme="dark"]
// and, absent an explicit choice, by prefers-color-scheme. The toggle
// (PortalShell) persists the explicit choice to localStorage.
import { touchTargetCSS, responsiveTableCSS, fieldCSS, down } from "@/lib/ui/tokens";

// Fonts are no longer fetched here. The Google Fonts @import that used to sit
// at the top of this string was inside a runtime-injected <style>, so it could
// not be preloaded and blocked first paint. Inter is now self-hosted via
// next/font in app/layout.tsx and reaches this file as --font-sans.
export const PORTAL_CSS = `

.portal {
  /* ── Layered surfaces: page < sunken < base < raised < overlay ── */
  --bg:#F4F5F8; --bg-2:#EEF0F5;
  --sunken:#EDEFF4; --surface:#FFFFFF; --surface2:#F7F8FB; --surface3:#EFF1F6;
  --raised:#FFFFFF; --overlay:rgba(255,255,255,.86);
  --line:#E4E7EE; --line-soft:#EDEFF4; --line-strong:#D3D8E2;
  --hairline:rgba(255,255,255,.9);
  /* ── Text ── */
  --text:#0A0C13; --text2:#3F4655; --muted:#6B7382; --muted2:#9AA2B1;
  /* ── Accents ── */
  --accent:#5B5FD6; --accent2:#8B76F0; --accent3:#4DA3F5;
  --accent-soft:rgba(91,95,214,.08); --accent-line:rgba(91,95,214,.20); --accent-glow:rgba(91,95,214,.24);
  --green:#0E9F72; --green-soft:rgba(14,159,114,.10);
  --amber:#C8820A; --amber-soft:rgba(200,130,10,.12);
  --red:#D94A4A; --red-soft:rgba(217,74,74,.10);
  --blue:#2F7DE1; --blue-soft:rgba(47,125,225,.10);
  --pink:#D3439B; --pink-soft:rgba(211,67,155,.10);
  /* ── Depth ── */
  --sh-1:0 1px 2px rgba(10,12,19,.05);
  --sh-2:0 2px 4px rgba(10,12,19,.04), 0 4px 12px rgba(10,12,19,.05);
  --sh-3:0 8px 24px rgba(10,12,19,.08), 0 2px 6px rgba(10,12,19,.04);
  --sh-4:0 20px 56px rgba(10,12,19,.14), 0 6px 16px rgba(10,12,19,.06);
  --sh-glow:0 0 0 1px var(--accent-line), 0 12px 32px var(--accent-glow);
  --glass:rgba(255,255,255,.74);
  /* ── Geometry ── */
  --r-xs:8px; --r-sm:11px; --r:15px; --r-lg:20px; --r-xl:26px;
  /* ── Mesh ── */
  --mesh:
    radial-gradient(80% 120% at 12% 0%, rgba(91,95,214,.10), transparent 55%),
    radial-gradient(70% 110% at 92% 8%, rgba(139,118,240,.11), transparent 58%),
    radial-gradient(90% 130% at 60% 100%, rgba(77,163,245,.07), transparent 62%);
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
  transition:background .3s ease, color .3s ease;
}
.portal a { color:inherit; }
.portal ::selection { background:var(--accent-glow); }
.portal :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:7px; }
.portal ::-webkit-scrollbar { width:11px; height:11px; }
.portal ::-webkit-scrollbar-thumb { background:var(--line-strong); border-radius:20px; border:3.5px solid transparent; background-clip:content-box; }
.portal ::-webkit-scrollbar-thumb:hover { background:var(--muted2); background-clip:content-box; }
.portal ::-webkit-scrollbar-track { background:transparent; }

@keyframes pShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes pPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
@keyframes pFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
@keyframes pBeacon { 0%{box-shadow:0 0 0 0 var(--accent-glow)} 70%{box-shadow:0 0 0 9px transparent} 100%{box-shadow:0 0 0 0 transparent} }

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
.p-side-brand { display:flex; align-items:center; gap:11px; padding:16px 15px 14px; border-bottom:1px solid var(--line-soft); }
.p-side-mark {
  width:34px; height:34px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(145deg,var(--accent3),var(--accent) 42%,var(--accent2));
  color:#fff; font-size:13px; font-weight:700; letter-spacing:-.03em;
  box-shadow:0 4px 12px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.3);
}
.p-side-names { min-width:0; }
.p-side-name { font-weight:600; font-size:13.5px; letter-spacing:-.02em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.p-side-sub { font-size:10.5px; color:var(--muted2); margin-top:1.5px; letter-spacing:.01em; }
.p-side-nav { flex:1; overflow-y:auto; padding:10px 9px 12px; display:flex; flex-direction:column; gap:1px; }
.p-nav-label { font-size:10px; font-weight:650; letter-spacing:.09em; text-transform:uppercase; color:var(--muted2); padding:16px 11px 7px; }
.p-nav-item {
  position:relative; display:flex; align-items:center; gap:11px; padding:8.5px 11px; border-radius:10px;
  color:var(--muted); font-size:13.5px; font-weight:500; text-decoration:none; cursor:pointer;
  transition:color .18s ease;
}
.p-nav-ico {
  width:26px; height:26px; border-radius:8px; display:flex; align-items:center; justify-content:center;
  flex-shrink:0; position:relative; z-index:1; transition:background .18s, color .18s, box-shadow .18s;
  background:transparent;
}
.p-nav-item:hover { color:var(--text); }
.p-nav-item:hover .p-nav-ico { background:var(--surface3); }
.p-nav-item.on { color:var(--text); font-weight:600; }
.p-nav-item.on .p-nav-ico {
  background:linear-gradient(145deg,var(--accent3),var(--accent) 45%,var(--accent2));
  color:#fff; box-shadow:0 3px 10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.28);
}
.p-nav-hl {
  position:absolute; inset:0; border-radius:10px; z-index:0;
  background:linear-gradient(90deg,var(--accent-soft),transparent 82%);
  border:1px solid var(--accent-line); border-left:2px solid var(--accent);
}
.p-nav-text { position:relative; z-index:1; }
.p-side-foot { padding:11px 13px 13px; border-top:1px solid var(--line-soft); display:flex; align-items:center; gap:8px; }
.p-icon-btn {
  background:var(--surface); border:1px solid var(--line); color:var(--muted); width:32px; height:32px;
  border-radius:9px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;
  box-shadow:var(--sh-1); transition:color .18s, border-color .18s, transform .18s;
}
.p-icon-btn:hover { color:var(--accent); border-color:var(--accent-line); transform:translateY(-1px); }
.p-signout-btn {
  flex:1; background:var(--surface); border:1px solid var(--line); color:var(--muted); padding:7px 12px;
  border-radius:9px; font-size:12.5px; font-family:inherit; cursor:pointer; font-weight:500; box-shadow:var(--sh-1);
  transition:color .18s, border-color .18s;
}
.p-signout-btn:hover { color:var(--text); border-color:var(--line-strong); }

.p-main-col { flex:1; min-width:0; display:flex; flex-direction:column; }
.p-topbar {
  display:none; align-items:center; justify-content:space-between; height:58px; padding:0 14px;
  background:var(--glass); backdrop-filter:saturate(180%) blur(18px); -webkit-backdrop-filter:saturate(180%) blur(18px);
  border-bottom:1px solid var(--line); position:sticky; top:0; z-index:150;
}
.p-main { flex:1; max-width:1280px; width:100%; margin:0 auto; padding:34px 34px 100px; }
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
  padding:9px 10px 9px 16px; margin-bottom:26px; font-size:12.5px; color:var(--text2);
}

/* ══ Typography ═════════════════════════════════════════════════════ */
.p-pagehead { display:flex; align-items:flex-start; justify-content:space-between; gap:22px; margin-bottom:30px; flex-wrap:wrap; }
.p-eyebrow {
  display:inline-flex; align-items:center; gap:7px; font-size:11px; font-weight:650;
  letter-spacing:.09em; text-transform:uppercase; color:var(--accent); margin-bottom:11px;
}
.p-eyebrow::before { content:''; width:5px; height:5px; border-radius:50%; background:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.p-h1 { font-size:29px; font-weight:680; letter-spacing:-.034em; margin:0 0 7px; line-height:1.14; }
.p-sub { color:var(--muted); font-size:14px; line-height:1.62; margin:0; max-width:620px; }

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
.p-mission-greet { font-size:12.5px; font-weight:550; color:var(--muted); margin-bottom:12px; display:flex; align-items:center; gap:8px; }
.p-mission-live { display:inline-flex; align-items:center; gap:6px; font-size:10.5px; font-weight:650; letter-spacing:.07em; text-transform:uppercase; color:var(--green); }
.p-mission-live i { width:6px; height:6px; border-radius:50%; background:var(--green); animation:pPulse 2.4s ease-in-out infinite; }
.p-mission-title {
  font-size:clamp(30px,4.4vw,46px); font-weight:720; letter-spacing:-.042em; line-height:1.02; margin:0 0 12px;
  background:linear-gradient(150deg,var(--text) 30%,var(--muted)); -webkit-background-clip:text; background-clip:text; color:transparent;
}
.p-mission-sub { font-size:14.5px; color:var(--muted); line-height:1.6; margin:0; max-width:460px; }
.p-mission-ring { position:relative; flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:12px; }
.p-mission-ring::after {
  content:''; position:absolute; inset:-22%; border-radius:50%; z-index:-1;
  background:radial-gradient(circle, var(--accent-glow), transparent 68%); filter:blur(14px);
}
.p-mission-verdict { font-size:11.5px; font-weight:600; letter-spacing:.02em; padding:4px 12px; border-radius:20px; }
.p-mission-strip {
  position:relative; display:grid; grid-template-columns:repeat(auto-fit,minmax(132px,1fr));
  margin:30px -36px 0; border-top:1px solid var(--line-soft); background:var(--surface2);
}
.p-mission-cell { padding:16px 20px; border-right:1px solid var(--line-soft); }
.p-mission-cell:last-child { border-right:0; }
.p-mission-cell-label { font-size:10.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--muted2); margin-bottom:6px; }
.p-mission-cell-val { font-size:20px; font-weight:660; letter-spacing:-.03em; font-variant-numeric:tabular-nums; display:flex; align-items:baseline; gap:7px; }
${down.sm} {
  .p-mission { padding:26px 22px 0; }
  .p-mission-strip { margin:24px -22px 0; }
  .p-mission-top { flex-direction:column; align-items:flex-start; }
}

/* ══ Hero aurora + quick actions ════════════════════════════════════ */
.p-mission-aurora {
  position:absolute; inset:-40% -10% auto -10%; height:150%; pointer-events:none; z-index:0;
  background:
    radial-gradient(38% 46% at 22% 34%, var(--accent-glow), transparent 62%),
    radial-gradient(34% 42% at 74% 22%, rgba(139,118,240,.20), transparent 64%),
    radial-gradient(40% 40% at 52% 78%, rgba(77,163,245,.14), transparent 66%);
  filter:blur(34px); opacity:.85;
}
.p-mission-top, .p-mission-strip { position:relative; z-index:1; }
.p-mission-actions { display:flex; flex-wrap:wrap; gap:9px; margin-top:22px; }
.p-quick {
  display:inline-flex; align-items:center; gap:8px; text-decoration:none;
  background:var(--surface); border:1px solid var(--line); color:var(--text2);
  padding:8px 13px; border-radius:11px; font-size:12.5px; font-weight:550;
  box-shadow:var(--sh-1); transition:border-color .18s, color .18s, transform .18s, box-shadow .18s;
}
.p-quick:hover { border-color:var(--accent-line); color:var(--accent); transform:translateY(-1px); box-shadow:var(--sh-2); }
.p-quick-count { font-size:11px; font-weight:700; padding:1px 7px; border-radius:20px; font-variant-numeric:tabular-nums; }
.p-quick-arrow { opacity:.45; transition:transform .18s, opacity .18s; }
.p-quick:hover .p-quick-arrow { opacity:1; transform:translateX(2px); }

/* ══ AI briefing band ═══════════════════════════════════════════════ */
.p-ai {
  position:relative; overflow:hidden; border-radius:var(--r-xl); border:1px solid var(--accent-line);
  background:var(--mesh), var(--surface); box-shadow:var(--sh-2); padding:26px 28px;
  display:flex; flex-direction:column; gap:20px;
}
.p-ai-head { display:flex; align-items:center; gap:13px; }
.p-ai-mark {
  width:38px; height:38px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(145deg,var(--accent3),var(--accent) 48%,var(--accent2)); color:#fff;
  box-shadow:0 6px 18px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.3);
}
.p-ai-eyebrow { font-size:10.5px; font-weight:680; letter-spacing:.09em; text-transform:uppercase; color:var(--accent); }
.p-ai-title { font-size:17px; font-weight:660; margin:3px 0 0; letter-spacing:-.026em; }
.p-ai-signals { display:grid; grid-template-columns:repeat(auto-fit,minmax(206px,1fr)); gap:11px; }
.p-ai-signal {
  display:flex; align-items:center; gap:11px; padding:15px 16px; border-radius:var(--r);
  background:var(--surface2); border:1px solid var(--line-soft); height:100%;
  transition:border-color .18s, background .18s, transform .18s;
}
.p-ai-signal-link { text-decoration:none; color:inherit; }
.p-ai-signal-link:hover { border-color:var(--accent-line); background:var(--surface); transform:translateY(-2px); box-shadow:var(--sh-2); }
.p-ai-count { font-size:26px; font-weight:700; letter-spacing:-.038em; line-height:1; font-variant-numeric:tabular-nums; flex-shrink:0; }
.p-ai-label { font-size:12.5px; color:var(--text2); line-height:1.42; flex:1; }
.p-ai-arrow { color:var(--muted2); flex-shrink:0; transition:transform .18s, color .18s; }
.p-ai-signal-link:hover .p-ai-arrow { color:var(--accent); transform:translateX(2px); }
.p-ai-opp {
  display:flex; align-items:center; gap:18px; flex-wrap:wrap;
  padding:18px 20px; border-radius:var(--r); border:1px solid var(--accent-line);
  background:linear-gradient(120deg,var(--accent-soft),transparent 70%), var(--surface);
}
.p-ai-opp-tag { font-size:10.5px; font-weight:680; letter-spacing:.08em; text-transform:uppercase; color:var(--accent); width:100%; }
.p-ai-opp-body { flex:1; min-width:200px; }
.p-ai-opp-kw { font-size:19px; font-weight:640; letter-spacing:-.028em; line-height:1.3; }
.p-ai-opp-meta { font-size:12.5px; color:var(--muted); margin-top:5px; }
.p-ai-opp-meta b { color:var(--text2); font-weight:640; font-variant-numeric:tabular-nums; }
.p-ai-opp-cta { flex-shrink:0; }
${down.sm} { .p-ai { padding:22px 18px; } .p-ai-opp-cta { width:100%; } }

/* ══ AI Opportunities ═══════════════════════════════════════════════ */
.p-opp-list { display:flex; flex-direction:column; gap:13px; }
.p-opp {
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg);
  padding:18px 20px; box-shadow:var(--sh-1); transition:border-color .2s, box-shadow .2s;
}
.p-opp:hover { border-color:var(--line-strong); box-shadow:var(--sh-2); }
.p-opp-head {
  display:flex; align-items:center; gap:14px; width:100%; background:none; border:0;
  padding:0; font:inherit; color:inherit; cursor:pointer; text-align:left;
}
.p-opp-headmain { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.p-opp-kind { font-size:10.5px; font-weight:650; letter-spacing:.07em; text-transform:uppercase; color:var(--muted2); }
.p-opp-title { font-size:15px; font-weight:620; letter-spacing:-.024em; line-height:1.35; }
.p-opp-facts { display:flex; gap:22px; flex-shrink:0; }
.p-opp-fact { display:flex; flex-direction:column; gap:2px; font-size:10.5px; color:var(--muted2); letter-spacing:.02em; }
.p-opp-fact b { font-size:12.5px; font-weight:620; color:var(--text2); letter-spacing:-.01em; }
.p-opp-chev { color:var(--muted2); flex-shrink:0; display:flex; }
.p-opp-impact { display:flex; flex-wrap:wrap; gap:7px; margin-top:13px; }
.p-opp-chip {
  font-size:11.5px; font-weight:520; padding:3.5px 10px; border-radius:20px;
  background:var(--surface2); border:1px solid var(--line-soft); color:var(--text2);
  font-variant-numeric:tabular-nums;
}
.p-opp-body { display:grid; grid-template-columns:1.15fr 1fr; gap:22px; padding:18px 0 4px; }
.p-opp-section h4 { font-size:10.5px; font-weight:680; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:0 0 8px; }
.p-opp-section p { font-size:13px; line-height:1.7; color:var(--text2); margin:0; }
.p-opp-steps { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.p-opp-steps li { display:flex; align-items:flex-start; gap:9px; font-size:12.5px; line-height:1.5; color:var(--text2); }
.p-opp-steps svg { color:var(--green); flex-shrink:0; margin-top:2px; }
.p-opp-expand {
  display:inline-flex; align-items:center; gap:6px; margin-top:14px; background:none; border:0;
  color:var(--accent); font-family:inherit; font-size:12.5px; font-weight:580; cursor:pointer; padding:0;
}
.p-opp-expand:hover { text-decoration:underline; }

/* ══ Execution panel ════════════════════════════════════════════════ */
.p-exec-panel { display:flex; flex-direction:column; gap:20px; margin-top:18px; padding-top:17px; border-top:1px solid var(--line-soft); }
.p-exec-group { display:flex; flex-direction:column; gap:10px; }
.p-exec-grouphead {
  display:flex; align-items:center; gap:6px; font-size:10.5px; font-weight:680; letter-spacing:.08em;
  text-transform:uppercase; color:var(--muted); margin:0;
}
.p-exec-grouphead svg { color:var(--accent); }
.p-exec-caps { display:grid; grid-template-columns:repeat(auto-fit,minmax(268px,1fr)); gap:9px; }
.p-cap {
  display:flex; align-items:center; gap:12px; text-align:left; width:100%;
  padding:13px 14px; border-radius:var(--r-sm); border:1px solid var(--line-soft);
  background:var(--surface2); font-family:inherit; color:inherit;
  transition:border-color .18s, background .18s, transform .18s;
}
.p-cap-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.p-cap-label { font-size:13px; font-weight:580; letter-spacing:-.012em; }
.p-cap-produces { font-size:11.5px; color:var(--muted); line-height:1.45; }
.p-cap-run { cursor:pointer; }
.p-cap-run:hover:not(:disabled) { border-color:var(--accent-line); background:var(--surface); transform:translateY(-1px); }
.p-cap-run:disabled { cursor:default; }
.p-cap-link { text-decoration:none; cursor:pointer; }
.p-cap-link:hover { border-color:var(--accent-line); background:var(--surface); transform:translateY(-1px); }
.p-cap-go {
  flex-shrink:0; font-size:11.5px; font-weight:640; color:var(--accent);
  background:var(--accent-soft); border:1px solid var(--accent-line); padding:4px 11px; border-radius:20px;
}
.p-cap-done { flex-shrink:0; color:var(--green); display:flex; }
.p-cap.is-done { border-color:transparent; background:var(--green-soft); }
.p-cap-arrow { color:var(--muted2); flex-shrink:0; }
.p-cap-soon { opacity:.62; }
.p-cap-soontag {
  flex-shrink:0; display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:640;
  letter-spacing:.05em; text-transform:uppercase; color:var(--muted); background:var(--surface3);
  border:1px solid var(--line); padding:3px 8px; border-radius:20px; white-space:nowrap;
}
.p-exec-queue { display:flex; flex-direction:column; gap:8px; }
.p-qitem {
  display:flex; align-items:center; gap:14px; padding:12px 14px; border-radius:var(--r-sm);
  background:var(--surface2); border:1px solid var(--line-soft); flex-wrap:wrap;
}
.p-qitem-main { flex:1; min-width:180px; display:flex; flex-direction:column; gap:3px; }
.p-qitem-title { font-size:13px; font-weight:560; letter-spacing:-.012em; }
.p-qitem-meta { font-size:11.5px; color:var(--muted); line-height:1.45; }
.p-qitem-actions { display:flex; align-items:center; gap:7px; flex-shrink:0; }
.p-qitem-btn { padding:6.5px 13px; font-size:12px; }
.p-qitem-state { display:inline-flex; align-items:center; gap:5px; }
.p-exec-more {
  display:inline-flex; align-items:center; gap:5px; font-size:12.5px; font-weight:580;
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
.p-tl-title { font-size:13.5px; font-weight:540; letter-spacing:-.012em; line-height:1.4; }
.p-tl-meta { font-size:11.5px; color:var(--muted); margin-top:3px; }

/* ══ Technical SEO findings ═════════════════════════════════════════ */
.p-tech-findings { display:flex; flex-direction:column; gap:9px; margin-bottom:4px; }
.p-tech-finding {
  display:flex; align-items:flex-start; gap:12px; padding:14px 15px; border-radius:var(--r-sm);
  background:var(--surface2); border:1px solid var(--line-soft); transition:border-color .18s;
}
.p-tech-finding:hover { border-color:var(--line); }
.p-tech-finding-ico {
  width:28px; height:28px; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:var(--amber-soft); color:var(--amber);
}
.p-tech-finding-title { font-size:13.5px; font-weight:580; letter-spacing:-.014em; line-height:1.4; }
.p-tech-finding-url {
  display:inline-block; margin-top:3px; font-size:11.5px; color:var(--accent);
  text-decoration:none; font-family:var(--font-mono);
}
.p-tech-finding-url:hover { text-decoration:underline; }
.p-tech-finding-why { font-size:12.5px; color:var(--muted); line-height:1.6; margin-top:6px; }
.p-tech-note {
  display:flex; align-items:flex-start; gap:9px; margin:0 0 16px;
  padding:12px 14px; border-radius:var(--r-sm);
  background:var(--surface2); border:1px solid var(--line-soft);
  font-size:12px; color:var(--muted); line-height:1.6;
}
.p-tech-note svg { color:var(--amber); flex-shrink:0; margin-top:2px; }

/* ══ Competitor Intelligence ════════════════════════════════════════ */
.p-comp-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(256px,1fr)); gap:11px; }
.p-comp {
  position:relative; display:flex; align-items:center; gap:4px;
  background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r);
  transition:border-color .2s, background .2s, box-shadow .2s;
}
.p-comp:hover { border-color:var(--accent-line); background:var(--surface); box-shadow:var(--sh-1); }
.p-comp.on { border-color:var(--accent); background:var(--surface); box-shadow:0 0 0 3px var(--accent-soft); }
.p-comp-main {
  flex:1; min-width:0; display:flex; align-items:center; gap:12px; padding:14px 4px 14px 14px;
  background:none; border:0; font:inherit; color:inherit; cursor:pointer; text-align:left;
}
.p-comp-avatar {
  width:36px; height:36px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(145deg,var(--accent3),var(--accent) 48%,var(--accent2)); color:#fff;
  font-size:12px; font-weight:700; letter-spacing:-.02em;
  box-shadow:0 3px 10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.26);
}
.p-comp-info { min-width:0; display:flex; flex-direction:column; gap:2px; }
.p-comp-domain { font-size:13.5px; font-weight:600; letter-spacing:-.016em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.p-comp-meta { font-size:11.5px; color:var(--muted); }
.p-comp-remove {
  flex-shrink:0; background:none; border:0; color:var(--muted2); cursor:pointer;
  padding:8px 12px 8px 6px; display:flex; align-items:center; transition:color .18s;
}
.p-comp-remove:hover { color:var(--red); }
.p-battle-none { font-size:11.5px; color:var(--muted2); font-style:italic; }
.p-battle-btn { padding:6px 12px; font-size:12px; white-space:nowrap; }

/* ══ Section label ══════════════════════════════════════════════════ */
.p-sectionlabel { margin-bottom:14px; }
.p-sectionlabel h2 { font-size:15px; font-weight:640; letter-spacing:-.024em; margin:0; }
.p-sectionlabel p { font-size:12.5px; color:var(--muted); margin:4px 0 0; line-height:1.55; }

/* ══ Panels ═════════════════════════════════════════════════════════ */
.p-panel {
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg);
  padding:22px; box-shadow:var(--sh-1); position:relative;
}
.p-panel-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; gap:12px; flex-wrap:wrap; }
.p-panel-title { font-size:15px; font-weight:640; letter-spacing:-.024em; margin:0; display:flex; align-items:center; gap:9px; }
.p-panel-sub { font-size:12.5px; color:var(--muted); line-height:1.6; margin:-12px 0 17px; }
.p-badge { font-size:11px; font-weight:600; padding:2.5px 8px; border-radius:20px; background:var(--surface2); color:var(--muted); border:1px solid var(--line); }
.p-badge.accent { background:var(--accent-soft); color:var(--accent); border-color:var(--accent-line); }
.p-badge.green { background:var(--green-soft); color:var(--green); border-color:transparent; }
.p-badge.amber { background:var(--amber-soft); color:var(--amber); border-color:transparent; }
.p-badge.red { background:var(--red-soft); color:var(--red); border-color:transparent; }

/* ══ Buttons ════════════════════════════════════════════════════════ */
.p-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:7px; font-family:inherit;
  font-size:13px; font-weight:580; letter-spacing:-.012em; padding:9.5px 17px; border-radius:11px;
  cursor:pointer; border:1px solid transparent; text-decoration:none; white-space:nowrap;
  transition:filter .18s, border-color .18s, color .18s, box-shadow .18s, transform .18s;
}
.p-btn.primary {
  background:linear-gradient(145deg,var(--accent3),var(--accent) 48%,var(--accent2)); color:#fff;
  box-shadow:0 4px 14px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.24);
}
.p-btn.primary:hover { filter:brightness(1.08); transform:translateY(-1px); }
.p-btn.ghost { background:var(--surface); border-color:var(--line); color:var(--text); box-shadow:var(--sh-1); }
.p-btn.ghost:hover { border-color:var(--accent-line); color:var(--accent); }
.p-btn:disabled { opacity:.45; cursor:not-allowed; filter:none; transform:none; }

/* ══ KPI cards ══════════════════════════════════════════════════════ */
.p-kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(196px,1fr)); gap:14px; }
.p-kpi {
  position:relative; overflow:hidden; background:var(--surface); border:1px solid var(--line);
  border-radius:var(--r); padding:18px; box-shadow:var(--sh-1);
  transition:border-color .22s, box-shadow .22s;
}
.p-kpi::before {
  content:''; position:absolute; inset:0 0 auto 0; height:1px;
  background:linear-gradient(90deg,transparent,var(--hairline),transparent);
}
.p-kpi::after {
  content:''; position:absolute; width:130px; height:130px; right:-52px; top:-62px; border-radius:50%;
  background:radial-gradient(circle,var(--kpi-tint,var(--accent-glow)),transparent 68%);
  opacity:0; transition:opacity .3s ease; pointer-events:none;
}
.p-kpi:hover { border-color:var(--line-strong); box-shadow:var(--sh-3); }
.p-kpi:hover::after { opacity:.7; }
.p-kpi-top { display:flex; align-items:center; gap:10px; margin-bottom:15px; }
.p-kpi-ico {
  width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center;
  flex-shrink:0; background:var(--kpi-soft,var(--accent-soft)); color:var(--kpi-color,var(--accent));
  border:1px solid var(--line-soft); box-shadow:inset 0 1px 0 var(--hairline);
}
.p-kpi-label { font-size:12px; font-weight:520; color:var(--muted); letter-spacing:-.008em; }
.p-kpi-mid { display:flex; align-items:flex-end; justify-content:space-between; gap:10px; }
.p-kpi-val { font-size:29px; font-weight:680; letter-spacing:-.038em; line-height:1.04; font-variant-numeric:tabular-nums; }
.p-kpi-spark { flex-shrink:0; opacity:.9; margin-bottom:2px; }
.p-spark { display:block; overflow:visible; }
.p-kpi-bottom { display:flex; align-items:center; gap:8px; margin-top:11px; min-height:19px; flex-wrap:wrap; }
.p-kpi-delta { font-size:11.5px; font-weight:640; padding:2px 8px; border-radius:20px; display:inline-flex; align-items:center; gap:3px; font-variant-numeric:tabular-nums; }
.p-kpi-delta.good { color:var(--green); background:var(--green-soft); }
.p-kpi-delta.bad { color:var(--red); background:var(--red-soft); }
.p-kpi-hint { font-size:11px; color:var(--muted2); display:inline-flex; align-items:center; gap:4px; }
.p-kpi-na { font-size:26px; font-weight:680; color:var(--muted2); letter-spacing:-.038em; }
.p-kpi-lock { position:absolute; top:14px; right:14px; color:var(--muted2); opacity:.65; }

/* ══ Score ring ═════════════════════════════════════════════════════ */
.p-ring-wrap { position:relative; flex-shrink:0; }
.p-ring-wrap svg { transform:rotate(-90deg); width:100%; height:100%; display:block; }
.p-ring-track { fill:none; stroke:var(--surface3); }
.p-ring-val { fill:none; stroke-linecap:round; }
.p-ring-num { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.p-ring-num b { font-weight:700; letter-spacing:-.04em; line-height:1; font-variant-numeric:tabular-nums; }
.p-ring-num span { font-size:9.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; margin-top:5px; font-weight:600; }

/* ══ Score cards ════════════════════════════════════════════════════ */
.p-score-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(172px,1fr)); gap:14px; }
.p-score-card {
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r);
  padding:22px 16px 19px; text-align:center; box-shadow:var(--sh-1);
  display:flex; flex-direction:column; align-items:center; transition:border-color .22s, box-shadow .22s;
}
.p-score-card:hover { border-color:var(--line-strong); box-shadow:var(--sh-2); }
.p-score-card .p-ring-wrap { margin:0 auto 13px; }
.p-score-card .p-ring-num span { display:none; }
.p-score-label { font-size:12.5px; font-weight:580; color:var(--text2); letter-spacing:-.014em; }
.p-score-locked { color:var(--muted2); font-size:10.5px; margin-top:6px; display:flex; align-items:center; justify-content:center; gap:4px; line-height:1.45; }

/* ══ Onboarding (was "not connected") ═══════════════════════════════ */
.p-onboard {
  position:relative; overflow:hidden; background:var(--surface); border:1px solid var(--line);
  border-radius:var(--r-lg); padding:22px; box-shadow:var(--sh-1);
  display:flex; flex-direction:column; gap:12px; transition:border-color .22s, box-shadow .22s;
}
.p-onboard::after {
  content:''; position:absolute; width:180px; height:180px; right:-70px; top:-88px; border-radius:50%;
  background:radial-gradient(circle,var(--accent-glow),transparent 70%); opacity:.5; transition:opacity .3s;
}
.p-onboard:hover { border-color:var(--accent-line); box-shadow:var(--sh-3); }
.p-onboard:hover::after { opacity:.9; }
.p-onboard-top { position:relative; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.p-onboard-ico {
  width:44px; height:44px; border-radius:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
  background:linear-gradient(145deg,var(--accent3),var(--accent) 48%,var(--accent2)); color:#fff;
  box-shadow:0 6px 18px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.3);
}
.p-onboard-tag { font-size:10px; font-weight:650; letter-spacing:.07em; text-transform:uppercase; color:var(--accent); background:var(--accent-soft); border:1px solid var(--accent-line); padding:3.5px 9px; border-radius:20px; white-space:nowrap; }
.p-onboard-title { position:relative; font-size:15px; font-weight:640; margin:0; letter-spacing:-.024em; }
.p-onboard-desc { position:relative; font-size:12.5px; color:var(--muted); line-height:1.65; margin:0; }
.p-onboard-list { position:relative; list-style:none; margin:2px 0 0; padding:0; display:flex; flex-direction:column; gap:7px; }
.p-onboard-list li { display:flex; align-items:flex-start; gap:8px; font-size:12.5px; color:var(--text2); line-height:1.5; }
.p-onboard-list svg { color:var(--green); flex-shrink:0; margin-top:2px; }
.p-onboard-foot { position:relative; display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:4px; flex-wrap:wrap; }
.p-onboard-note { font-size:11.5px; color:var(--muted2); line-height:1.5; }

/* ══ Empty states ═══════════════════════════════════════════════════ */
.p-empty {
  position:relative; overflow:hidden; border:1px solid var(--line); border-radius:var(--r-lg);
  padding:46px 26px; text-align:center; background:var(--mesh), var(--surface2);
}
.p-empty-icon {
  width:54px; height:54px; margin:0 auto 16px; border-radius:16px; display:flex; align-items:center; justify-content:center;
  background:var(--surface); border:1px solid var(--line); color:var(--accent); font-size:21px;
  box-shadow:var(--sh-2), inset 0 1px 0 var(--hairline);
}
.p-empty-title { font-size:15px; font-weight:640; color:var(--text); margin-bottom:7px; letter-spacing:-.022em; }
.p-empty-sub { font-size:13px; color:var(--muted); max-width:380px; margin:0 auto; line-height:1.66; }

/* ══ Priorities ═════════════════════════════════════════════════════ */
.p-priority-list { display:flex; flex-direction:column; gap:8px; }
.p-priority {
  display:flex; align-items:flex-start; gap:12px; padding:14px 15px;
  background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r-sm);
  transition:background .18s, border-color .18s, transform .18s;
}
.p-priority-link { text-decoration:none; color:inherit; }
.p-priority-link:hover { background:var(--surface); border-color:var(--accent-line); transform:translateX(3px); box-shadow:var(--sh-1); }
.p-priority-dot { width:8px; height:8px; border-radius:50%; margin-top:5.5px; flex-shrink:0; }
.p-priority-text { font-size:13.5px; font-weight:530; line-height:1.45; letter-spacing:-.012em; }
.p-priority-sub { font-size:12px; color:var(--muted); margin-top:3px; line-height:1.5; }
.p-priority-arrow { color:var(--muted2); flex-shrink:0; align-self:center; transition:transform .18s, color .18s; }
.p-priority-link:hover .p-priority-arrow { color:var(--accent); transform:translateX(2px); }

/* ══ Feed ═══════════════════════════════════════════════════════════ */
.p-feed { display:flex; flex-direction:column; }
.p-feed-item { display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-bottom:1px solid var(--line-soft); }
.p-feed-item:last-child { border-bottom:0; padding-bottom:0; }
.p-feed-item:first-child { padding-top:0; }
.p-feed-icon { width:29px; height:29px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px; border:1px solid var(--line-soft); }
.p-feed-title { font-size:13px; font-weight:520; line-height:1.45; letter-spacing:-.01em; }
.p-feed-meta { font-size:11.5px; color:var(--muted); margin-top:2.5px; }

/* ══ AI summary ═════════════════════════════════════════════════════ */
.p-exec {
  position:relative; overflow:hidden; border:1px solid var(--accent-line); border-radius:var(--r-lg);
  padding:22px 24px; display:flex; gap:16px; align-items:flex-start;
  background:var(--mesh), var(--surface);
  box-shadow:var(--sh-2);
}
.p-exec-icon {
  width:36px; height:36px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(145deg,var(--accent3),var(--accent) 48%,var(--accent2)); color:#fff;
  box-shadow:0 5px 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.28);
}
.p-exec-label { font-size:10.5px; font-weight:680; letter-spacing:.09em; text-transform:uppercase; color:var(--accent); margin-bottom:7px; }
.p-exec-text { font-size:14px; line-height:1.72; color:var(--text2); margin:0; }

/* ══ Tables ═════════════════════════════════════════════════════════ */
.p-table { width:100%; border-collapse:collapse; }
.p-table th { text-align:left; font-size:11px; font-weight:620; letter-spacing:.03em; color:var(--muted); padding:0 12px 11px; border-bottom:1px solid var(--line); white-space:nowrap; }
.p-table td { padding:13px 12px; font-size:13px; border-bottom:1px solid var(--line-soft); color:var(--text2); }
.p-table tbody tr:last-child td { border-bottom:0; }
.p-table tbody tr { transition:background .14s; }
.p-table tbody tr:hover td { background:var(--surface2); }
/* .rt-scroll shares this bleed-to-panel-edge treatment; .rt-stack opts out
   below sm, where cards should sit inside the panel padding (Phase 3). */
.p-table-wrap, .rt-scroll { overflow-x:auto; margin:0 -22px; padding:0 22px; }
.p-table-sort { background:none; border:0; font:inherit; font-size:11px; font-weight:620; letter-spacing:.03em; color:var(--muted); cursor:pointer; padding:0; display:inline-flex; align-items:center; gap:4px; transition:color .18s; }
.p-table-sort:hover { color:var(--text); }
.p-table-sort.on { color:var(--accent); }
.p-kwcell { font-weight:570; color:var(--text); max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:-.012em; }
.p-pos { display:inline-flex; min-width:31px; justify-content:center; font-size:11.5px; font-weight:640; padding:3px 8px; border-radius:7px; background:var(--surface3); color:var(--muted); font-variant-numeric:tabular-nums; }
.p-pos.top3 { background:var(--green-soft); color:var(--green); }
.p-pos.top10 { background:var(--accent-soft); color:var(--accent); }
.p-pos.top20 { background:var(--amber-soft); color:var(--amber); }
.p-chip { font-size:11px; font-weight:520; padding:2.5px 8px; border-radius:7px; background:var(--surface2); color:var(--muted); border:1px solid var(--line-soft); text-transform:capitalize; white-space:nowrap; }
.p-na { color:var(--muted2); }

/* ══ Inputs ═════════════════════════════════════════════════════════ */
.p-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:17px; }
.p-input { background:var(--surface); border:1px solid var(--line); color:var(--text); padding:9.5px 13px; border-radius:11px; font-family:inherit; font-size:13px; min-width:200px; flex:1; box-shadow:var(--sh-1); transition:border-color .18s, box-shadow .18s; }
.p-input::placeholder { color:var(--muted2); }
.p-input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3.5px var(--accent-soft); }
.p-select { background:var(--surface); border:1px solid var(--line); color:var(--text); padding:9.5px 11px; border-radius:11px; font-family:inherit; font-size:13px; cursor:pointer; box-shadow:var(--sh-1); }
.p-select:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3.5px var(--accent-soft); }
.p-pager { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; font-size:12.5px; color:var(--muted); flex-wrap:wrap; }
.p-pager-btns { display:flex; gap:8px; }
.p-pager-btn { background:var(--surface); border:1px solid var(--line); color:var(--text); padding:7.5px 14px; border-radius:10px; font-family:inherit; font-size:12.5px; cursor:pointer; box-shadow:var(--sh-1); transition:.18s; }
.p-pager-btn:disabled { opacity:.4; cursor:not-allowed; }
.p-pager-btn:not(:disabled):hover { border-color:var(--accent); color:var(--accent); }

/* ══ Sub nav ════════════════════════════════════════════════════════ */
.p-subnav { display:flex; gap:3px; overflow-x:auto; padding:4px; background:var(--sunken); border:1px solid var(--line); border-radius:13px; margin-bottom:24px; }
.p-subnav::-webkit-scrollbar { height:0; }
.p-subnav-btn { position:relative; display:inline-flex; align-items:center; gap:7px; background:transparent; border:0; color:var(--muted); padding:8.5px 15px; border-radius:10px; font-family:inherit; font-size:13px; font-weight:520; cursor:pointer; white-space:nowrap; transition:color .18s; }
.p-subnav-btn:hover { color:var(--text); }
.p-subnav-btn.on { color:var(--text); font-weight:600; }
.p-subnav-hl { position:absolute; inset:0; background:var(--surface); border-radius:10px; box-shadow:var(--sh-2); z-index:0; }
.p-subnav-inner { position:relative; z-index:1; display:inline-flex; align-items:center; gap:7px; }
.p-subnav-count { font-size:10.5px; font-weight:640; background:var(--surface3); color:var(--muted); padding:1px 6px; border-radius:20px; font-variant-numeric:tabular-nums; }
.p-subnav-btn.on .p-subnav-count { background:var(--accent-soft); color:var(--accent); }

/* ══ Stat tiles ═════════════════════════════════════════════════════ */
.p-stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(136px,1fr)); gap:11px; }
.p-stattile { background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r-sm); padding:15px; transition:border-color .18s, background .18s, transform .18s; }
.p-stattile:hover { border-color:var(--line); background:var(--surface); transform:translateY(-1px); }
.p-stattile-val { font-size:22px; font-weight:670; letter-spacing:-.034em; line-height:1.14; font-variant-numeric:tabular-nums; }
.p-stattile-label { font-size:11.5px; color:var(--muted); margin-top:5px; font-weight:480; }
.p-stattile-sub { font-size:10.5px; color:var(--muted2); margin-top:3px; }

/* ══ Movement ═══════════════════════════════════════════════════════ */
.p-move-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 0; border-bottom:1px solid var(--line-soft); }
.p-move-row:last-child { border-bottom:0; padding-bottom:0; }
.p-move-row:first-child { padding-top:0; }
.p-move-kw { font-size:13px; font-weight:520; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:-.01em; }
.p-move-delta { font-size:11.5px; font-weight:640; display:inline-flex; align-items:center; gap:3px; padding:2.5px 8px; border-radius:20px; flex-shrink:0; font-variant-numeric:tabular-nums; }
.p-move-delta.up { color:var(--green); background:var(--green-soft); }
.p-move-delta.down { color:var(--red); background:var(--red-soft); }
.p-move-delta.flat { color:var(--muted); background:var(--surface3); }

/* ══ Recommendations ════════════════════════════════════════════════ */
.p-rec-list { display:flex; flex-direction:column; gap:11px; }
.p-rec { background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r); padding:18px; transition:border-color .2s, background .2s; }
.p-rec:hover { border-color:var(--accent-line); background:var(--surface); }
.p-rec-top { display:flex; align-items:flex-start; gap:12px; margin-bottom:10px; }
.p-rec-icon { width:30px; height:30px; border-radius:9px; background:var(--accent-soft); color:var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid var(--accent-line); }
.p-rec-title { font-size:13.5px; font-weight:620; line-height:1.4; letter-spacing:-.018em; }
.p-rec-text { font-size:12.5px; color:var(--muted); line-height:1.68; margin:0 0 14px; }
.p-rec-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.p-rec-impact { font-size:11.5px; font-weight:580; color:var(--green); }

/* ══ Approvals ══════════════════════════════════════════════════════ */
.p-approve { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg); padding:21px; box-shadow:var(--sh-1); transition:border-color .2s, box-shadow .2s; }
.p-approve:hover { border-color:var(--line-strong); box-shadow:var(--sh-2); }
.p-approve-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:13px; }
.p-approve-title { font-size:15px; font-weight:640; margin:8px 0 0; line-height:1.4; letter-spacing:-.022em; }
.p-approve-meta { font-size:12px; color:var(--muted); margin-top:7px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.p-approve-body { background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r-sm); padding:16px; font-size:13px; line-height:1.72; color:var(--text2); white-space:pre-wrap; word-break:break-word; }
.p-approve-more { background:none; border:0; color:var(--accent); font-family:inherit; font-size:12.5px; font-weight:580; cursor:pointer; padding:10px 0 0; }
.p-approve-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:16px; flex-wrap:wrap; }
.p-approve-actions { display:flex; gap:8px; margin-left:auto; }
.p-approve-done { display:flex; align-items:center; gap:11px; padding:16px 21px; }
.p-approve-donetitle { font-size:13px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.p-cardlist { display:flex; flex-direction:column; gap:13px; }
.p-review-quote { background:var(--surface2); border-left:2.5px solid var(--accent-line); border-radius:0 var(--r-sm) var(--r-sm) 0; padding:13px 16px; font-size:12.5px; line-height:1.68; color:var(--muted); font-style:italic; margin-bottom:14px; }
.p-reply-label { font-size:10.5px; font-weight:680; letter-spacing:.08em; text-transform:uppercase; color:var(--accent); margin-bottom:8px; }
.p-stars { color:var(--amber); font-size:12px; letter-spacing:1.5px; }

/* ══ Chart tooltip ══════════════════════════════════════════════════ */
.p-tip { background:var(--overlay); backdrop-filter:blur(14px) saturate(180%); -webkit-backdrop-filter:blur(14px) saturate(180%); border:1px solid var(--line); border-radius:12px; box-shadow:var(--sh-4); padding:11px 13px; min-width:132px; }
.p-tip-label { font-size:10.5px; font-weight:620; letter-spacing:.06em; text-transform:uppercase; color:var(--muted2); margin-bottom:8px; }
.p-tip-row { display:flex; align-items:center; justify-content:space-between; gap:16px; font-size:12.5px; padding:2.5px 0; }
.p-tip-key { display:flex; align-items:center; gap:7px; color:var(--muted); }
.p-tip-dot { width:7px; height:7px; border-radius:2.5px; flex-shrink:0; }
.p-tip-val { font-weight:640; color:var(--text); font-variant-numeric:tabular-nums; }

/* ══ Skeletons ══════════════════════════════════════════════════════ */
.p-skel { background:linear-gradient(90deg,var(--surface2) 25%,var(--surface3) 50%,var(--surface2) 75%); background-size:200% 100%; border-radius:var(--r); animation:pShimmer 1.7s ease-in-out infinite; }

/* ══ Layout ═════════════════════════════════════════════════════════ */
.p-2col { display:grid; grid-template-columns:1.4fr 1fr; gap:20px; align-items:start; }
${down.md} { .p-2col { grid-template-columns:1fr; } }
.p-stack { display:flex; flex-direction:column; gap:20px; min-width:0; }
.p-home { display:flex; flex-direction:column; gap:20px; }
.p-subgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(268px,1fr)); gap:15px; }
.p-site-card { display:flex; align-items:center; justify-content:space-between; text-decoration:none; color:var(--text); font-weight:570; font-size:13px; padding:18px 21px; letter-spacing:-.014em; transition:border-color .2s, color .2s; }
.p-site-card:hover { border-color:var(--accent-line); color:var(--accent); }
.p-ministat-row { display:flex; gap:11px; }
.p-ministat { flex:1; text-align:center; background:var(--surface2); border:1px solid var(--line-soft); border-radius:var(--r-sm); padding:16px 8px; }
.p-ministat-n { font-size:23px; font-weight:670; letter-spacing:-.034em; font-variant-numeric:tabular-nums; }
.p-ministat-label { font-size:11.5px; color:var(--muted); margin-top:4px; }

/* ══ Settings ═══════════════════════════════════════════════════════ */
.p-deflist { margin:0; display:flex; flex-direction:column; }
.p-def { display:flex; gap:18px; padding:15px 0; border-bottom:1px solid var(--line-soft); flex-wrap:wrap; }
.p-def:last-child { border-bottom:0; padding-bottom:0; }
.p-def:first-child { padding-top:0; }
.p-def dt { font-size:12.5px; color:var(--muted); font-weight:520; min-width:162px; }
.p-def dd { margin:0; font-size:13.5px; flex:1; min-width:200px; word-break:break-word; color:var(--text2); }
.p-conn-list { display:flex; flex-direction:column; }
.p-conn { display:flex; align-items:flex-start; gap:14px; padding:18px 0; border-bottom:1px solid var(--line-soft); flex-wrap:wrap; }
.p-conn:last-child { border-bottom:0; padding-bottom:0; }
.p-conn:first-child { padding-top:0; }
.p-conn-dot { width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:var(--surface2); color:var(--muted2); flex-shrink:0; border:1px solid var(--line-soft); }
.p-conn-dot.on { background:var(--green-soft); color:var(--green); border-color:transparent; }
.p-conn-name { font-size:13.5px; font-weight:620; letter-spacing:-.018em; }
.p-conn-desc { font-size:12.5px; color:var(--muted); margin-top:3px; line-height:1.6; }
.p-conn-detail { display:inline-block; margin-top:8px; font-family:var(--font-mono); font-size:10.5px; background:var(--surface2); border:1px solid var(--line-soft); padding:2.5px 8px; border-radius:7px; color:var(--muted); }

/* ══ Assistant ══════════════════════════════════════════════════════ */
.p-assistant-page { height:calc(100vh - 190px); min-height:540px; }
.p-chat { flex:1; display:flex; flex-direction:column; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-xl); box-shadow:var(--sh-2); overflow:hidden; min-height:0; }
.p-chat-scroll { flex:1; overflow-y:auto; padding:28px; display:flex; flex-direction:column; gap:18px; }
.p-chat-welcome { margin:auto; text-align:center; max-width:560px; padding:20px 0; }
.p-chat-welcome-icon { width:54px; height:54px; margin:0 auto 18px; border-radius:17px; display:flex; align-items:center; justify-content:center; background:linear-gradient(145deg,var(--accent3),var(--accent) 48%,var(--accent2)); color:#fff; box-shadow:0 10px 28px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.3); animation:pFloat 5s ease-in-out infinite; }
.p-chat-welcome-title { font-size:22px; font-weight:680; margin:0 0 9px; letter-spacing:-.03em; }
.p-chat-welcome-sub { font-size:13.5px; color:var(--muted); line-height:1.68; margin:0 0 24px; }
.p-chat-suggestions { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
.p-chat-suggestion { background:var(--surface); border:1px solid var(--line); color:var(--text2); padding:9.5px 15px; border-radius:20px; font-family:inherit; font-size:12.5px; cursor:pointer; text-align:left; box-shadow:var(--sh-1); transition:border-color .18s, color .18s, transform .18s; }
.p-chat-suggestion:hover { border-color:var(--accent-line); color:var(--accent); transform:translateY(-1px); }
.p-msg { display:flex; gap:12px; align-items:flex-start; }
.p-msg.user { justify-content:flex-end; }
.p-msg-avatar { width:30px; height:30px; border-radius:10px; background:linear-gradient(145deg,var(--accent3),var(--accent) 48%,var(--accent2)); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; box-shadow:0 3px 10px var(--accent-glow); }
.p-msg-bubble { max-width:min(680px,80%); padding:14px 17px; border-radius:15px; font-size:13.5px; line-height:1.72; white-space:pre-wrap; word-break:break-word; }
.p-msg.assistant .p-msg-bubble { background:var(--surface2); border:1px solid var(--line-soft); border-top-left-radius:5px; color:var(--text2); }
.p-msg.user .p-msg-bubble { background:linear-gradient(145deg,var(--accent3),var(--accent) 48%,var(--accent2)); color:#fff; border-top-right-radius:5px; box-shadow:0 4px 14px var(--accent-glow); }
.p-msg-typing { display:flex; gap:5px; align-items:center; padding:17px; }
.p-msg-typing span { width:6px; height:6px; border-radius:50%; background:var(--muted2); animation:pPulse 1.2s infinite; }
.p-msg-typing span:nth-child(2) { animation-delay:.18s; }
.p-msg-typing span:nth-child(3) { animation-delay:.36s; }
.p-chat-error { font-size:12.5px; color:var(--red); background:var(--red-soft); padding:12px 15px; border-radius:11px; }
.p-chat-input-row { display:flex; gap:10px; padding:16px; border-top:1px solid var(--line-soft); background:var(--surface); }
${down.md} { .p-assistant-page { height:calc(100vh - 150px); } .p-msg-bubble { max-width:88%; } }

/* ══ Report ═════════════════════════════════════════════════════════ */
.p-report { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-xl); padding:38px; box-shadow:var(--sh-1); }
.p-report-head { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; border-bottom:1px solid var(--line-strong); padding-bottom:24px; margin-bottom:28px; flex-wrap:wrap; }
.p-report-title { font-size:24px; font-weight:680; margin:0 0 6px; letter-spacing:-.034em; }
.p-report-period { font-size:12.5px; color:var(--muted); }
.p-report-section { margin-bottom:30px; }
.p-report-section h3 { font-size:11px; font-weight:680; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:0 0 14px; }
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
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px;
    padding:7px 2px 5px; border:0; background:none; cursor:pointer;
    font-family:inherit; color:var(--muted2); text-decoration:none;
    -webkit-tap-highlight-color:transparent;
    transition:color .18s ease;
  }
  .p-bnav-item:hover { color:var(--text2); }
  .p-bnav-item.on { color:var(--accent); }
  .p-bnav-ico {
    position:relative; display:flex; align-items:center; justify-content:center;
    width:44px; height:27px; border-radius:9px;
  }
  .p-bnav-ico > svg { position:relative; z-index:1; }
  .p-bnav-pill {
    position:absolute; inset:0; border-radius:9px; z-index:0;
    background:var(--accent-soft); border:1px solid var(--accent-line);
  }
  .p-bnav-label { font-size:10.5px; font-weight:560; letter-spacing:-.005em; line-height:1; }

  /* The drawer sits above the bottom bar rather than behind it. */
  .p-side-mobile { z-index:200; }
  .p-scrim { z-index:190; }
}

/* Printing a report should never include navigation chrome. */
@media print { .p-bnav { display:none !important; } }
`;

function darkVars() {
  return `
  --bg:#07080B; --bg-2:#0A0C10;
  --sunken:#0B0D12; --surface:#101218; --surface2:#161921; --surface3:#1E222B;
  --raised:#14171E; --overlay:rgba(16,18,24,.86);
  --line:#212632; --line-soft:#1A1E27; --line-strong:#2E3441;
  --hairline:rgba(255,255,255,.055);
  --text:#F3F5F8; --text2:#B2B9C6; --muted:#7F8797; --muted2:#59616F;
  --accent:#7C7FE8; --accent2:#A78BFA; --accent3:#5AA2F7;
  --accent-soft:rgba(124,127,232,.13); --accent-line:rgba(124,127,232,.28); --accent-glow:rgba(124,127,232,.30);
  --green:#2DD4A0; --green-soft:rgba(45,212,160,.13);
  --amber:#F2B03C; --amber-soft:rgba(242,176,60,.14);
  --red:#F1706A; --red-soft:rgba(241,112,106,.13);
  --blue:#5AA2F7; --blue-soft:rgba(90,162,247,.13);
  --pink:#F06BB4; --pink-soft:rgba(240,107,180,.13);
  --sh-1:0 1px 2px rgba(0,0,0,.36);
  --sh-2:0 2px 6px rgba(0,0,0,.4), 0 8px 22px rgba(0,0,0,.32);
  --sh-3:0 10px 32px rgba(0,0,0,.5), 0 3px 8px rgba(0,0,0,.35);
  --sh-4:0 24px 64px rgba(0,0,0,.62), 0 8px 20px rgba(0,0,0,.4);
  --sh-glow:0 0 0 1px var(--accent-line), 0 14px 38px var(--accent-glow);
  --glass:rgba(16,18,24,.72);
  --mesh:
    radial-gradient(80% 120% at 12% 0%, rgba(124,127,232,.15), transparent 55%),
    radial-gradient(70% 110% at 92% 8%, rgba(167,139,250,.13), transparent 58%),
    radial-gradient(90% 130% at 60% 100%, rgba(90,162,247,.09), transparent 62%);
  color-scheme: dark;`;
}
