// Shared design system for the customer Portal (Dashboard 2.0). Everything is
// scoped under .portal so it can never bleed into or be affected by the admin
// dashboard's own styles (app/dashboard/page.tsx), which is untouched.
//
// Theme: CSS custom properties on .portal, overridden by [data-theme="dark"]
// and, absent an explicit choice, by prefers-color-scheme. The toggle
// (PortalShell) persists the explicit choice to localStorage.
export const PORTAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

.portal {
  --bg:#F7F8FC; --surface:#FFFFFF; --surface2:#F2F4F9; --surface3:#EAEDF4;
  --line:#E8EAF0; --text:#12172A; --muted:#8A93A6; --muted2:#B2BAC8;
  --accent:#6C5CE7; --accent-soft:rgba(108,92,231,.1); --accent2:#8B7CF6;
  --green:#00B894; --green-soft:rgba(0,184,148,.1);
  --amber:#F5B461; --amber-soft:rgba(245,180,97,.14);
  --red:#E14B4B; --red-soft:rgba(225,75,75,.1);
  --blue:#0984E3; --blue-soft:rgba(9,132,227,.1);
  --pink:#E84393; --pink-soft:rgba(232,67,147,.1);
  --shadow:0 1px 3px rgba(16,24,40,.04);
  --shadow-lg:0 12px 32px rgba(16,24,40,.08);
  --radius:18px; --radius-sm:12px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  .portal:not([data-theme="light"]) {
    --bg:#0A0C13; --surface:#12141F; --surface2:#181B28; --surface3:#20232F;
    --line:#262A38; --text:#F1F3F8; --muted:#8D95AA; --muted2:#5C6478;
    --accent:#8B7CF6; --accent-soft:rgba(139,124,246,.16); --accent2:#A79BFA;
    --green:#2DD9A8; --green-soft:rgba(45,217,168,.14);
    --amber:#F5B461; --amber-soft:rgba(245,180,97,.16);
    --red:#F0685E; --red-soft:rgba(240,104,94,.14);
    --blue:#4DA3F5; --blue-soft:rgba(77,163,245,.14);
    --pink:#F06BB0; --pink-soft:rgba(240,107,176,.14);
    --shadow:0 1px 3px rgba(0,0,0,.3);
    --shadow-lg:0 16px 40px rgba(0,0,0,.4);
    color-scheme: dark;
  }
}
.portal[data-theme="dark"] {
  --bg:#0A0C13; --surface:#12141F; --surface2:#181B28; --surface3:#20232F;
  --line:#262A38; --text:#F1F3F8; --muted:#8D95AA; --muted2:#5C6478;
  --accent:#8B7CF6; --accent-soft:rgba(139,124,246,.16); --accent2:#A79BFA;
  --green:#2DD9A8; --green-soft:rgba(45,217,168,.14);
  --amber:#F5B461; --amber-soft:rgba(245,180,97,.16);
  --red:#F0685E; --red-soft:rgba(240,104,94,.14);
  --blue:#4DA3F5; --blue-soft:rgba(77,163,245,.14);
  --pink:#F06BB0; --pink-soft:rgba(240,107,176,.14);
  --shadow:0 1px 3px rgba(0,0,0,.3);
  --shadow-lg:0 16px 40px rgba(0,0,0,.4);
  color-scheme: dark;
}

.portal * { box-sizing:border-box; }
.portal {
  min-height:100vh; background:var(--bg); color:var(--text);
  font-family:'Space Grotesk',-apple-system,'Segoe UI',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased; transition:background .2s ease,color .2s ease;
}
.portal a { color:inherit; }
.portal ::selection { background:var(--accent-soft); }

@keyframes pRise { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
@keyframes pShimmer { 0%{background-position:200%} 100%{background-position:-200%} }
@keyframes pPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
@keyframes pSpin { to{transform:rotate(360deg)} }

/* ── App shell ─────────────────────────────────────────────────────── */
.p-shell { display:flex; min-height:100vh; }
.p-side {
  width:248px; flex-shrink:0; background:var(--surface); border-right:1px solid var(--line);
  display:flex; flex-direction:column; position:sticky; top:0; height:100vh; z-index:200;
  transition:transform .25s ease;
}
.p-side-brand { display:flex; align-items:center; gap:10px; padding:22px 20px 18px; }
.p-side-dot { width:11px; height:11px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--green)); flex-shrink:0; box-shadow:0 0 0 4px var(--accent-soft); }
.p-side-name { font-weight:700; font-size:15px; letter-spacing:-.01em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.p-side-nav { flex:1; overflow-y:auto; padding:6px 12px; display:flex; flex-direction:column; gap:2px; }
.p-nav-item {
  display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:11px;
  color:var(--muted); font-size:13.5px; font-weight:500; text-decoration:none; cursor:pointer;
  border:1px solid transparent; transition:background .15s,color .15s;
}
.p-nav-item:hover { background:var(--surface2); color:var(--text); }
.p-nav-item.on { background:var(--accent-soft); color:var(--accent); font-weight:600; }
.p-nav-item svg { flex-shrink:0; }
.p-nav-badge { margin-left:auto; font-size:10.5px; font-weight:700; background:var(--surface3); color:var(--muted); padding:1px 7px; border-radius:20px; }
.p-nav-item.on .p-nav-badge { background:var(--accent); color:#fff; }
.p-side-foot { padding:14px 20px 18px; border-top:1px solid var(--line); display:flex; align-items:center; gap:10px; }
.p-theme-btn { background:var(--surface2); border:1px solid var(--line); color:var(--muted); width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.p-theme-btn:hover { color:var(--text); }
.p-signout-btn { flex:1; background:transparent; border:1px solid var(--line); color:var(--muted); padding:8px 12px; border-radius:10px; font-size:12.5px; font-family:inherit; cursor:pointer; }
.p-signout-btn:hover { color:var(--text); border-color:var(--muted2); }

.p-main-col { flex:1; min-width:0; display:flex; flex-direction:column; }
.p-topbar {
  display:none; align-items:center; justify-content:space-between; height:58px;
  padding:0 18px; background:var(--surface); border-bottom:1px solid var(--line);
  position:sticky; top:0; z-index:150;
}
.p-topbar-menu { background:transparent; border:0; color:var(--text); cursor:pointer; padding:6px; }
.p-main { flex:1; max-width:1220px; width:100%; margin:0 auto; padding:36px 32px 90px; }
.p-scrim { display:none; position:fixed; inset:0; background:rgba(8,10,16,.5); z-index:190; }

@media (max-width:920px) {
  .p-side { position:fixed; left:0; transform:translateX(-100%); box-shadow:var(--shadow-lg); }
  .p-side.open { transform:translateX(0); }
  .p-topbar { display:flex; }
  .p-scrim.open { display:block; }
  .p-main { padding:24px 16px 70px; }
}

/* ── Page header ───────────────────────────────────────────────────── */
.p-pagehead { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:26px; flex-wrap:wrap; }
.p-eyebrow { font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--accent); margin-bottom:6px; display:flex; align-items:center; gap:6px; }
.p-h1 { font-size:26px; font-weight:700; letter-spacing:-.02em; margin:0 0 4px; }
.p-sub { color:var(--muted); font-size:14px; margin:0; max-width:560px; }

/* ── Cards / panels ────────────────────────────────────────────────── */
.p-card { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); animation:pRise .45s ease both; }
.p-panel { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:22px; box-shadow:var(--shadow); animation:pRise .45s ease both; }
.p-panel-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; gap:10px; flex-wrap:wrap; }
.p-panel-title { font-size:15.5px; font-weight:700; margin:0; display:flex; align-items:center; gap:8px; }
.p-panel-sub { font-size:12.5px; color:var(--muted); margin:-10px 0 14px; }
.p-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; background:var(--surface2); color:var(--muted); }
.p-badge.accent { background:var(--accent-soft); color:var(--accent); }
.p-badge.green { background:var(--green-soft); color:var(--green); }
.p-badge.amber { background:var(--amber-soft); color:#B5791E; }
.portal[data-theme="dark"] .p-badge.amber { color:var(--amber); }
@media (prefers-color-scheme:dark){ .portal:not([data-theme="light"]) .p-badge.amber { color:var(--amber); } }
.p-badge.red { background:var(--red-soft); color:var(--red); }

/* ── Buttons ───────────────────────────────────────────────────────── */
.p-btn { display:inline-flex; align-items:center; gap:8px; font-family:inherit; font-size:13px; font-weight:600; padding:10px 18px; border-radius:11px; cursor:pointer; border:1px solid transparent; transition:.15s; text-decoration:none; }
.p-btn.primary { background:var(--accent); color:#fff; box-shadow:0 4px 14px var(--accent-soft); }
.p-btn.primary:hover { filter:brightness(1.08); transform:translateY(-1px); }
.p-btn.ghost { background:var(--surface); border-color:var(--line); color:var(--text); }
.p-btn.ghost:hover { border-color:var(--muted2); }
.p-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }

/* ── KPI / score cards ─────────────────────────────────────────────── */
.p-kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; }
.p-kpi { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-sm); padding:18px; box-shadow:var(--shadow); animation:pRise .45s ease both; position:relative; overflow:hidden; }
.p-kpi-top { display:flex; align-items:center; gap:8px; margin-bottom:12px; color:var(--muted); }
.p-kpi-icon { width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.p-kpi-label { font-size:11.5px; font-weight:600; color:var(--muted); letter-spacing:.02em; }
.p-kpi-val { font-size:28px; font-weight:700; letter-spacing:-.02em; line-height:1.1; }
.p-kpi-bottom { display:flex; align-items:center; gap:8px; margin-top:8px; min-height:18px; flex-wrap:wrap; }
.p-kpi-delta { font-size:11.5px; font-weight:700; padding:2px 8px; border-radius:20px; display:inline-flex; align-items:center; gap:3px; }
.p-kpi-delta.good { color:var(--green); background:var(--green-soft); }
.p-kpi-delta.bad { color:var(--red); background:var(--red-soft); }
.p-kpi-hint { font-size:11px; color:var(--muted2); }
.p-kpi-na { font-size:22px; font-weight:700; color:var(--muted2); }

/* ── Score ring ────────────────────────────────────────────────────── */
.p-ring-wrap { position:relative; width:96px; height:96px; flex-shrink:0; }
.p-ring-wrap svg { transform:rotate(-90deg); width:100%; height:100%; }
.p-ring-track { fill:none; stroke:var(--surface2); stroke-width:8; }
.p-ring-val { fill:none; stroke-width:8; stroke-linecap:round; transition:stroke-dashoffset 1s cubic-bezier(.16,1,.3,1); }
.p-ring-num { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.p-ring-num b { font-size:24px; font-weight:700; letter-spacing:-.02em; line-height:1; }
.p-ring-num span { font-size:9.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-top:2px; }

/* ── Score chip grid (SEO / Local / Website / AI / GBP) ───────────── */
.p-score-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; }
.p-score-card { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-sm); padding:16px; text-align:center; box-shadow:var(--shadow); animation:pRise .45s ease both; }
.p-score-card .p-ring-wrap { width:64px; height:64px; margin:0 auto 10px; }
.p-score-card .p-ring-num b { font-size:18px; }
.p-score-card .p-ring-num span { display:none; }
.p-score-label { font-size:12px; font-weight:600; color:var(--muted); }
.p-score-locked { color:var(--muted2); font-size:10.5px; margin-top:4px; display:flex; align-items:center; justify-content:center; gap:3px; }

/* ── Priorities list ───────────────────────────────────────────────── */
.p-priority-list { display:flex; flex-direction:column; gap:10px; }
.p-priority { display:flex; align-items:flex-start; gap:12px; padding:13px 14px; background:var(--surface2); border-radius:var(--radius-sm); }
.p-priority-dot { width:8px; height:8px; border-radius:50%; margin-top:5px; flex-shrink:0; }
.p-priority-text { font-size:13.5px; font-weight:500; line-height:1.5; }
.p-priority-sub { font-size:12px; color:var(--muted); margin-top:2px; }

/* ── Activity feed ─────────────────────────────────────────────────── */
.p-feed { display:flex; flex-direction:column; gap:2px; }
.p-feed-item { display:flex; align-items:flex-start; gap:12px; padding:12px 4px; border-bottom:1px solid var(--line); }
.p-feed-item:last-child { border-bottom:0; }
.p-feed-icon { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.p-feed-title { font-size:13.5px; font-weight:500; }
.p-feed-meta { font-size:11.5px; color:var(--muted); margin-top:2px; }

/* ── Exec summary card ─────────────────────────────────────────────── */
.p-exec { background:linear-gradient(135deg,var(--accent-soft),var(--blue-soft)); border:1px solid var(--line); border-radius:var(--radius); padding:20px; display:flex; gap:14px; align-items:flex-start; animation:pRise .45s ease both; }
.p-exec-icon { width:34px; height:34px; border-radius:10px; background:var(--surface); display:flex; align-items:center; justify-content:center; color:var(--accent); flex-shrink:0; box-shadow:var(--shadow); }
.p-exec-label { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--accent); margin-bottom:4px; }
.p-exec-text { font-size:14px; line-height:1.65; color:var(--text); margin:0; }

/* ── Tables ────────────────────────────────────────────────────────── */
.p-table { width:100%; border-collapse:collapse; }
.p-table th { text-align:left; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); padding:9px 10px; border-bottom:1px solid var(--line); }
.p-table td { padding:12px 10px; font-size:13px; border-bottom:1px solid var(--line); }
.p-table tr:last-child td { border-bottom:0; }
.p-table tr:hover td { background:var(--surface2); }

/* ── Empty / coming-soon states ────────────────────────────────────── */
.p-empty { border:1.5px dashed var(--line); border-radius:var(--radius); padding:40px 24px; text-align:center; color:var(--muted); background:var(--surface2); }
.p-empty-icon { font-size:28px; margin-bottom:10px; opacity:.7; }
.p-empty-title { font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px; }
.p-empty-sub { font-size:12.5px; color:var(--muted); max-width:340px; margin:0 auto; }
.p-coming-badge { display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; background:var(--amber-soft); color:#A5680F; padding:3px 9px; border-radius:20px; }
@media (prefers-color-scheme:dark){.portal:not([data-theme="light"]) .p-coming-badge{color:var(--amber)}}
.portal[data-theme="dark"] .p-coming-badge{color:var(--amber)}

/* ── Skeletons ─────────────────────────────────────────────────────── */
.p-skel { background:linear-gradient(90deg,var(--surface2),var(--surface3),var(--surface2)); background-size:200%; border-radius:var(--radius-sm); animation:pShimmer 1.4s infinite; }

/* ── Section grid (for placeholder sub-cards: Local SEO / Website / etc) ── */
.p-subgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; }
.p-subcard { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:20px; box-shadow:var(--shadow); animation:pRise .45s ease both; display:flex; flex-direction:column; gap:10px; }
.p-subcard-top { display:flex; align-items:center; justify-content:space-between; }
.p-subcard-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; }
.p-subcard-title { font-size:14.5px; font-weight:700; margin:0; }
.p-subcard-desc { font-size:12.5px; color:var(--muted); line-height:1.55; margin:0; flex:1; }

/* ── Responsive grids ──────────────────────────────────────────────── */
.p-2col { display:grid; grid-template-columns:1.35fr 1fr; gap:20px; align-items:start; }
@media (max-width:900px) { .p-2col { grid-template-columns:1fr; } }
.p-stack { display:flex; flex-direction:column; gap:20px; min-width:0; }

/* ── Home dashboard ────────────────────────────────────────────────── */
.p-home { display:flex; flex-direction:column; gap:20px; }
.p-hero-card {
  background:linear-gradient(135deg,var(--surface),var(--surface2));
  border:1px solid var(--line); border-radius:var(--radius); padding:30px 32px;
  display:flex; align-items:center; justify-content:space-between; gap:28px;
  box-shadow:var(--shadow); animation:pRise .45s ease both; flex-wrap:wrap;
}
.p-hero-card .p-h1 { font-size:30px; }
.p-hero-ring { flex-shrink:0; }
.p-priority-link { text-decoration:none; color:inherit; transition:background .15s,transform .15s; }
.p-priority-link:hover { background:var(--surface3); transform:translateX(2px); }
.p-site-card { display:flex; align-items:center; justify-content:space-between; text-decoration:none; color:var(--accent); font-weight:600; font-size:13.5px; padding:18px 22px; }
.p-site-card:hover { border-color:var(--accent); }
.p-ministat-row { display:flex; gap:12px; }
.p-ministat { flex:1; text-align:center; background:var(--surface2); border-radius:var(--radius-sm); padding:14px 8px; }
.p-ministat-n { font-size:24px; font-weight:700; letter-spacing:-.02em; }
.p-ministat-label { font-size:11.5px; color:var(--muted); margin-top:3px; }
@media (max-width:540px) {
  .p-hero-card { flex-direction:column; align-items:flex-start; padding:24px; }
  .p-hero-card .p-h1 { font-size:25px; }
}
`;
