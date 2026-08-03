// Design system for the customer Portal. Everything is scoped under .portal so
// it can never bleed into or be affected by the admin dashboard's own styles
// (app/dashboard/page.tsx), which is untouched.
//
// Theme: CSS custom properties on .portal, overridden by [data-theme="dark"]
// and, absent an explicit choice, by prefers-color-scheme. The toggle
// (PortalShell) persists the explicit choice to localStorage.
export const PORTAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

.portal {
  /* ── Surfaces ── */
  --bg:#FBFBFD; --surface:#FFFFFF; --surface2:#F6F7F9; --surface3:#EDEFF3;
  --line:#E7E9EE; --line-strong:#D6DAE2;
  /* ── Text ── */
  --text:#0B0D14; --text2:#454C5C; --muted:#6F7787; --muted2:#A0A7B5;
  /* ── Accents ── */
  --accent:#5B5FD6; --accent2:#7C7FE8; --accent-soft:rgba(91,95,214,.09); --accent-line:rgba(91,95,214,.22);
  --green:#0EA47A; --green-soft:rgba(14,164,122,.10);
  --amber:#D48806; --amber-soft:rgba(212,136,6,.12);
  --red:#DC4B4B; --red-soft:rgba(220,75,75,.10);
  --blue:#2F7DE1; --blue-soft:rgba(47,125,225,.10);
  --pink:#D9439B; --pink-soft:rgba(217,67,155,.10);
  /* ── Depth ── */
  --shadow-xs:0 1px 2px rgba(11,13,20,.04);
  --shadow:0 1px 3px rgba(11,13,20,.05), 0 1px 2px rgba(11,13,20,.03);
  --shadow-md:0 4px 12px rgba(11,13,20,.06), 0 2px 4px rgba(11,13,20,.03);
  --shadow-lg:0 16px 40px rgba(11,13,20,.10), 0 4px 12px rgba(11,13,20,.05);
  --glass:rgba(255,255,255,.72);
  --hero-glow:radial-gradient(120% 140% at 88% -20%, rgba(91,95,214,.10), transparent 62%);
  /* ── Geometry ── */
  --r-xs:8px; --r-sm:10px; --r:14px; --r-lg:18px; --r-xl:24px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  .portal:not([data-theme="light"]) {
    --bg:#08090C; --surface:#0E1015; --surface2:#14161C; --surface3:#1C1F27;
    --line:#1F232C; --line-strong:#2C313C;
    --text:#F4F6F8; --text2:#B4BAC6; --muted:#828A99; --muted2:#5C6472;
    --accent:#7C7FE8; --accent2:#9A9CF2; --accent-soft:rgba(124,127,232,.14); --accent-line:rgba(124,127,232,.30);
    --green:#2DD4A0; --green-soft:rgba(45,212,160,.13);
    --amber:#F2B03C; --amber-soft:rgba(242,176,60,.14);
    --red:#F1706A; --red-soft:rgba(241,112,106,.13);
    --blue:#5AA2F7; --blue-soft:rgba(90,162,247,.13);
    --pink:#F06BB4; --pink-soft:rgba(240,107,180,.13);
    --shadow-xs:0 1px 2px rgba(0,0,0,.30);
    --shadow:0 1px 3px rgba(0,0,0,.40);
    --shadow-md:0 6px 18px rgba(0,0,0,.44);
    --shadow-lg:0 20px 50px rgba(0,0,0,.58);
    --glass:rgba(14,16,21,.70);
    --hero-glow:radial-gradient(120% 140% at 88% -20%, rgba(124,127,232,.16), transparent 62%);
    color-scheme: dark;
  }
}
.portal[data-theme="dark"] {
  --bg:#08090C; --surface:#0E1015; --surface2:#14161C; --surface3:#1C1F27;
  --line:#1F232C; --line-strong:#2C313C;
  --text:#F4F6F8; --text2:#B4BAC6; --muted:#828A99; --muted2:#5C6472;
  --accent:#7C7FE8; --accent2:#9A9CF2; --accent-soft:rgba(124,127,232,.14); --accent-line:rgba(124,127,232,.30);
  --green:#2DD4A0; --green-soft:rgba(45,212,160,.13);
  --amber:#F2B03C; --amber-soft:rgba(242,176,60,.14);
  --red:#F1706A; --red-soft:rgba(241,112,106,.13);
  --blue:#5AA2F7; --blue-soft:rgba(90,162,247,.13);
  --pink:#F06BB4; --pink-soft:rgba(240,107,180,.13);
  --shadow-xs:0 1px 2px rgba(0,0,0,.30);
  --shadow:0 1px 3px rgba(0,0,0,.40);
  --shadow-md:0 6px 18px rgba(0,0,0,.44);
  --shadow-lg:0 20px 50px rgba(0,0,0,.58);
  --glass:rgba(14,16,21,.70);
  --hero-glow:radial-gradient(120% 140% at 88% -20%, rgba(124,127,232,.16), transparent 62%);
  color-scheme: dark;
}

.portal * { box-sizing:border-box; }
.portal {
  min-height:100vh; background:var(--bg); color:var(--text);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  font-feature-settings:'cv02','cv03','cv04','ss01';
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
  letter-spacing:-0.011em;
  transition:background .25s ease, color .25s ease;
}
.portal a { color:inherit; }
.portal ::selection { background:var(--accent-soft); }
.portal :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:6px; }
.portal ::-webkit-scrollbar { width:10px; height:10px; }
.portal ::-webkit-scrollbar-thumb { background:var(--line-strong); border-radius:20px; border:3px solid transparent; background-clip:content-box; }
.portal ::-webkit-scrollbar-thumb:hover { background:var(--muted2); background-clip:content-box; }
.portal ::-webkit-scrollbar-track { background:transparent; }

@keyframes pShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes pPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes pSpin { to{transform:rotate(360deg)} }

/* ── App shell ─────────────────────────────────────────────────────── */
.p-shell { display:flex; min-height:100vh; }
.p-side {
  width:256px; flex-shrink:0; background:var(--surface); border-right:1px solid var(--line);
  display:flex; flex-direction:column; position:sticky; top:0; height:100vh; z-index:200;
}
.p-side-brand { display:flex; align-items:center; gap:11px; padding:22px 20px 16px; }
.p-side-mark {
  width:30px; height:30px; border-radius:9px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(140deg,var(--accent),var(--accent2)); color:#fff;
  font-size:13px; font-weight:700; letter-spacing:-.02em;
  box-shadow:0 2px 8px var(--accent-soft), inset 0 1px 0 rgba(255,255,255,.22);
}
.p-side-names { min-width:0; }
.p-side-name { font-weight:600; font-size:13.5px; letter-spacing:-.015em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.p-side-sub { font-size:11px; color:var(--muted2); margin-top:1px; }
.p-side-nav { flex:1; overflow-y:auto; padding:6px 10px 12px; display:flex; flex-direction:column; gap:1px; }
.p-nav-label { font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--muted2); padding:14px 12px 6px; }
.p-nav-item {
  position:relative; display:flex; align-items:center; gap:11px; padding:8px 11px; border-radius:9px;
  color:var(--muted); font-size:13.5px; font-weight:450; text-decoration:none; cursor:pointer;
  transition:color .16s ease;
}
.p-nav-item svg { flex-shrink:0; opacity:.85; transition:opacity .16s ease; }
.p-nav-item:hover { color:var(--text); }
.p-nav-item:hover svg { opacity:1; }
.p-nav-item.on { color:var(--text); font-weight:550; }
.p-nav-item.on svg { color:var(--accent); opacity:1; }
.p-nav-hl { position:absolute; inset:0; background:var(--surface2); border-radius:9px; z-index:-1; }
.p-nav-text { position:relative; z-index:1; }
.p-side-foot { padding:12px 14px 16px; border-top:1px solid var(--line); display:flex; align-items:center; gap:8px; }
.p-icon-btn {
  background:transparent; border:1px solid var(--line); color:var(--muted); width:32px; height:32px;
  border-radius:9px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;
  transition:color .16s, border-color .16s, background .16s;
}
.p-icon-btn:hover { color:var(--text); border-color:var(--line-strong); background:var(--surface2); }
.p-signout-btn {
  flex:1; background:transparent; border:1px solid var(--line); color:var(--muted); padding:7px 12px;
  border-radius:9px; font-size:12.5px; font-family:inherit; cursor:pointer; font-weight:450;
  transition:color .16s, border-color .16s, background .16s;
}
.p-signout-btn:hover { color:var(--text); border-color:var(--line-strong); background:var(--surface2); }

.p-main-col { flex:1; min-width:0; display:flex; flex-direction:column; }
.p-topbar {
  display:none; align-items:center; justify-content:space-between; height:56px; padding:0 14px;
  background:var(--glass); backdrop-filter:saturate(180%) blur(16px); -webkit-backdrop-filter:saturate(180%) blur(16px);
  border-bottom:1px solid var(--line); position:sticky; top:0; z-index:150;
}
.p-main { flex:1; max-width:1240px; width:100%; margin:0 auto; padding:40px 36px 96px; }
.p-scrim { display:none; position:fixed; inset:0; background:rgba(6,7,11,.55); backdrop-filter:blur(2px); z-index:190; }

.p-side-mobile { position:fixed; left:0; top:0; box-shadow:var(--shadow-lg); display:none; }
@media (max-width:960px) {
  .p-side-desktop { display:none; }
  .p-side-mobile { display:flex; }
  .p-topbar { display:flex; }
  .p-scrim.open { display:block; }
  .p-main { padding:24px 18px 72px; }
}

/* ── Admin preview banner ──────────────────────────────────────────── */
.p-preview {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  background:var(--amber-soft); border:1px solid var(--line); border-radius:var(--r);
  padding:9px 10px 9px 16px; margin-bottom:26px; font-size:12.5px; color:var(--text2);
}

/* ── Page header ───────────────────────────────────────────────────── */
.p-pagehead { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:30px; flex-wrap:wrap; }
.p-eyebrow {
  display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:600;
  letter-spacing:.06em; text-transform:uppercase; color:var(--accent); margin-bottom:9px;
}
.p-h1 { font-size:27px; font-weight:650; letter-spacing:-.028em; margin:0 0 6px; line-height:1.18; }
.p-sub { color:var(--muted); font-size:14px; line-height:1.6; margin:0; max-width:600px; }

/* ── Cards / panels ────────────────────────────────────────────────── */
.p-panel {
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg);
  padding:22px; box-shadow:var(--shadow-xs);
}
.p-panel-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; gap:12px; flex-wrap:wrap; }
.p-panel-title { font-size:14.5px; font-weight:600; letter-spacing:-.015em; margin:0; display:flex; align-items:center; gap:9px; }
.p-panel-sub { font-size:12.5px; color:var(--muted); line-height:1.6; margin:-12px 0 16px; }
.p-badge {
  font-size:11px; font-weight:600; padding:2.5px 8px; border-radius:20px;
  background:var(--surface2); color:var(--muted); border:1px solid var(--line);
}
.p-badge.accent { background:var(--accent-soft); color:var(--accent); border-color:var(--accent-line); }
.p-badge.green { background:var(--green-soft); color:var(--green); border-color:transparent; }
.p-badge.amber { background:var(--amber-soft); color:var(--amber); border-color:transparent; }
.p-badge.red { background:var(--red-soft); color:var(--red); border-color:transparent; }

/* ── Buttons ───────────────────────────────────────────────────────── */
.p-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:7px; font-family:inherit;
  font-size:13px; font-weight:550; letter-spacing:-.008em; padding:9px 16px; border-radius:10px;
  cursor:pointer; border:1px solid transparent; text-decoration:none; white-space:nowrap;
  transition:background .16s, border-color .16s, color .16s, box-shadow .16s;
}
.p-btn.primary {
  background:linear-gradient(180deg,var(--accent2),var(--accent)); color:#fff;
  box-shadow:0 1px 2px rgba(11,13,20,.16), inset 0 1px 0 rgba(255,255,255,.18);
}
.p-btn.primary:hover { filter:brightness(1.06); }
.p-btn.ghost { background:var(--surface); border-color:var(--line); color:var(--text); box-shadow:var(--shadow-xs); }
.p-btn.ghost:hover { border-color:var(--line-strong); background:var(--surface2); }
.p-btn:disabled { opacity:.45; cursor:not-allowed; filter:none; }

/* ── KPI cards ─────────────────────────────────────────────────────── */
.p-kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(184px,1fr)); gap:14px; }
.p-kpi {
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r);
  padding:17px 18px; box-shadow:var(--shadow-xs); position:relative; overflow:hidden;
}
.p-kpi::after {
  content:''; position:absolute; inset:0 0 auto 0; height:1px;
  background:linear-gradient(90deg,transparent,var(--line-strong),transparent); opacity:.55;
}
.p-kpi-top { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
.p-kpi-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.p-kpi-label { font-size:12px; font-weight:500; color:var(--muted); letter-spacing:-.005em; }
.p-kpi-val { font-size:27px; font-weight:640; letter-spacing:-.03em; line-height:1.08; font-variant-numeric:tabular-nums; }
.p-kpi-bottom { display:flex; align-items:center; gap:8px; margin-top:9px; min-height:18px; flex-wrap:wrap; }
.p-kpi-delta { font-size:11.5px; font-weight:600; padding:1.5px 7px; border-radius:20px; display:inline-flex; align-items:center; gap:3px; font-variant-numeric:tabular-nums; }
.p-kpi-delta.good { color:var(--green); background:var(--green-soft); }
.p-kpi-delta.bad { color:var(--red); background:var(--red-soft); }
.p-kpi-hint { font-size:11px; color:var(--muted2); display:inline-flex; align-items:center; gap:4px; }
.p-kpi-na { font-size:24px; font-weight:640; color:var(--muted2); letter-spacing:-.03em; }

/* ── Score ring ────────────────────────────────────────────────────── */
.p-ring-wrap { position:relative; flex-shrink:0; }
.p-ring-wrap svg { transform:rotate(-90deg); width:100%; height:100%; display:block; }
.p-ring-track { fill:none; stroke:var(--surface3); }
.p-ring-val { fill:none; stroke-linecap:round; }
.p-ring-num { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.p-ring-num b { font-weight:650; letter-spacing:-.03em; line-height:1; font-variant-numeric:tabular-nums; }
.p-ring-num span { font-size:9.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.07em; margin-top:4px; font-weight:550; }

/* ── Score cards ───────────────────────────────────────────────────── */
.p-score-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(168px,1fr)); gap:14px; }
.p-score-card {
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r);
  padding:20px 16px 18px; text-align:center; box-shadow:var(--shadow-xs);
  display:flex; flex-direction:column; align-items:center;
}
.p-score-card .p-ring-wrap { margin:0 auto 12px; }
.p-score-card .p-ring-num span { display:none; }
.p-score-label { font-size:12.5px; font-weight:550; color:var(--text2); letter-spacing:-.008em; }
.p-score-locked { color:var(--muted2); font-size:10.5px; margin-top:5px; display:flex; align-items:center; justify-content:center; gap:4px; line-height:1.4; }

/* ── Priorities ────────────────────────────────────────────────────── */
.p-priority-list { display:flex; flex-direction:column; gap:8px; }
.p-priority {
  display:flex; align-items:flex-start; gap:12px; padding:13px 14px;
  background:var(--surface2); border:1px solid transparent; border-radius:var(--r-sm);
  transition:background .16s, border-color .16s;
}
.p-priority-link { text-decoration:none; color:inherit; }
.p-priority-link:hover { background:var(--surface3); border-color:var(--line); }
.p-priority-dot { width:7px; height:7px; border-radius:50%; margin-top:6px; flex-shrink:0; }
.p-priority-text { font-size:13.5px; font-weight:500; line-height:1.45; letter-spacing:-.008em; }
.p-priority-sub { font-size:12px; color:var(--muted); margin-top:3px; line-height:1.5; }

/* ── Activity feed ─────────────────────────────────────────────────── */
.p-feed { display:flex; flex-direction:column; }
.p-feed-item { display:flex; align-items:flex-start; gap:11px; padding:12px 0; border-bottom:1px solid var(--line); }
.p-feed-item:last-child { border-bottom:0; padding-bottom:0; }
.p-feed-item:first-child { padding-top:0; }
.p-feed-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px; }
.p-feed-title { font-size:13px; font-weight:500; line-height:1.45; letter-spacing:-.008em; }
.p-feed-meta { font-size:11.5px; color:var(--muted); margin-top:2px; }

/* ── AI executive summary ──────────────────────────────────────────── */
.p-exec {
  position:relative; border:1px solid var(--accent-line); border-radius:var(--r-lg); padding:20px 22px;
  display:flex; gap:15px; align-items:flex-start; overflow:hidden;
  background:linear-gradient(135deg,var(--accent-soft),transparent 62%), var(--surface);
}
.p-exec-icon {
  width:32px; height:32px; border-radius:9px; background:var(--surface); border:1px solid var(--accent-line);
  display:flex; align-items:center; justify-content:center; color:var(--accent); flex-shrink:0; box-shadow:var(--shadow-xs);
}
.p-exec-label { font-size:10.5px; font-weight:650; letter-spacing:.08em; text-transform:uppercase; color:var(--accent); margin-bottom:6px; }
.p-exec-text { font-size:13.5px; line-height:1.7; color:var(--text2); margin:0; }

/* ── Tables ────────────────────────────────────────────────────────── */
.p-table { width:100%; border-collapse:collapse; }
.p-table th {
  text-align:left; font-size:11px; font-weight:600; letter-spacing:.02em; color:var(--muted);
  padding:0 12px 10px; border-bottom:1px solid var(--line); white-space:nowrap;
}
.p-table td { padding:13px 12px; font-size:13px; border-bottom:1px solid var(--line); color:var(--text2); }
.p-table tbody tr:last-child td { border-bottom:0; }
.p-table tbody tr { transition:background .12s; }
.p-table tbody tr:hover td { background:var(--surface2); }
.p-table-wrap { overflow-x:auto; margin:0 -22px; padding:0 22px; }
.p-table-sort {
  background:none; border:0; font:inherit; font-size:11px; font-weight:600; letter-spacing:.02em;
  color:var(--muted); cursor:pointer; padding:0; display:inline-flex; align-items:center; gap:4px;
  transition:color .16s;
}
.p-table-sort:hover { color:var(--text); }
.p-table-sort.on { color:var(--accent); }
.p-kwcell { font-weight:550; color:var(--text); max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:-.008em; }
.p-pos {
  display:inline-flex; min-width:30px; justify-content:center; font-size:11.5px; font-weight:600;
  padding:2.5px 8px; border-radius:7px; background:var(--surface3); color:var(--muted); font-variant-numeric:tabular-nums;
}
.p-pos.top3 { background:var(--green-soft); color:var(--green); }
.p-pos.top10 { background:var(--accent-soft); color:var(--accent); }
.p-pos.top20 { background:var(--amber-soft); color:var(--amber); }
.p-chip {
  font-size:11px; font-weight:500; padding:2px 8px; border-radius:6px;
  background:var(--surface2); color:var(--muted); border:1px solid var(--line); text-transform:capitalize; white-space:nowrap;
}
.p-na { color:var(--muted2); }

/* ── Toolbar / inputs ──────────────────────────────────────────────── */
.p-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:16px; }
.p-input {
  background:var(--surface); border:1px solid var(--line); color:var(--text); padding:9px 13px;
  border-radius:10px; font-family:inherit; font-size:13px; min-width:200px; flex:1;
  box-shadow:var(--shadow-xs); transition:border-color .16s, box-shadow .16s;
}
.p-input::placeholder { color:var(--muted2); }
.p-input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.p-select {
  background:var(--surface); border:1px solid var(--line); color:var(--text); padding:9px 11px;
  border-radius:10px; font-family:inherit; font-size:13px; cursor:pointer; box-shadow:var(--shadow-xs);
}
.p-select:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.p-pager { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; font-size:12.5px; color:var(--muted); flex-wrap:wrap; }
.p-pager-btns { display:flex; gap:8px; }
.p-pager-btn {
  background:var(--surface); border:1px solid var(--line); color:var(--text); padding:7px 14px;
  border-radius:9px; font-family:inherit; font-size:12.5px; cursor:pointer; box-shadow:var(--shadow-xs); transition:.16s;
}
.p-pager-btn:disabled { opacity:.4; cursor:not-allowed; }
.p-pager-btn:not(:disabled):hover { border-color:var(--accent); color:var(--accent); }

/* ── Sub navigation ────────────────────────────────────────────────── */
.p-subnav { display:flex; gap:3px; overflow-x:auto; padding:3px; background:var(--surface2); border:1px solid var(--line); border-radius:12px; margin-bottom:24px; }
.p-subnav::-webkit-scrollbar { height:0; }
.p-subnav-btn {
  position:relative; display:inline-flex; align-items:center; gap:7px; background:transparent; border:0;
  color:var(--muted); padding:8px 14px; border-radius:9px; font-family:inherit; font-size:13px;
  font-weight:500; cursor:pointer; white-space:nowrap; transition:color .16s;
}
.p-subnav-btn:hover { color:var(--text); }
.p-subnav-btn.on { color:var(--text); font-weight:550; }
.p-subnav-hl { position:absolute; inset:0; background:var(--surface); border-radius:9px; box-shadow:var(--shadow-xs); z-index:0; }
.p-subnav-inner { position:relative; z-index:1; display:inline-flex; align-items:center; gap:7px; }
.p-subnav-count { font-size:10.5px; font-weight:600; background:var(--surface3); color:var(--muted); padding:1px 6px; border-radius:20px; font-variant-numeric:tabular-nums; }
.p-subnav-btn.on .p-subnav-count { background:var(--accent-soft); color:var(--accent); }

/* ── Stat tiles ────────────────────────────────────────────────────── */
.p-stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(132px,1fr)); gap:11px; }
.p-stattile { background:var(--surface2); border:1px solid transparent; border-radius:var(--r-sm); padding:14px; transition:border-color .16s, background .16s; }
.p-stattile:hover { border-color:var(--line); background:var(--surface3); }
.p-stattile-val { font-size:21px; font-weight:640; letter-spacing:-.028em; line-height:1.15; font-variant-numeric:tabular-nums; }
.p-stattile-label { font-size:11.5px; color:var(--muted); margin-top:5px; font-weight:450; }
.p-stattile-sub { font-size:10.5px; color:var(--muted2); margin-top:3px; }

/* ── Movement rows ─────────────────────────────────────────────────── */
.p-move-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 0; border-bottom:1px solid var(--line); }
.p-move-row:last-child { border-bottom:0; padding-bottom:0; }
.p-move-row:first-child { padding-top:0; }
.p-move-kw { font-size:13px; font-weight:500; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:-.008em; }
.p-move-delta { font-size:11.5px; font-weight:600; display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:20px; flex-shrink:0; font-variant-numeric:tabular-nums; }
.p-move-delta.up { color:var(--green); background:var(--green-soft); }
.p-move-delta.down { color:var(--red); background:var(--red-soft); }
.p-move-delta.flat { color:var(--muted); background:var(--surface3); }

/* ── Recommendations ───────────────────────────────────────────────── */
.p-rec-list { display:flex; flex-direction:column; gap:11px; }
.p-rec { background:var(--surface2); border:1px solid var(--line); border-radius:var(--r); padding:17px; transition:border-color .16s; }
.p-rec:hover { border-color:var(--line-strong); }
.p-rec-top { display:flex; align-items:flex-start; gap:11px; margin-bottom:9px; }
.p-rec-icon { width:28px; height:28px; border-radius:8px; background:var(--accent-soft); color:var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.p-rec-title { font-size:13.5px; font-weight:600; line-height:1.4; letter-spacing:-.012em; }
.p-rec-text { font-size:12.5px; color:var(--muted); line-height:1.65; margin:0 0 13px; }
.p-rec-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.p-rec-impact { font-size:11.5px; font-weight:550; color:var(--green); }

/* ── Approval cards ────────────────────────────────────────────────── */
.p-approve { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg); padding:20px; box-shadow:var(--shadow-xs); }
.p-approve-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:13px; }
.p-approve-title { font-size:14.5px; font-weight:600; margin:7px 0 0; line-height:1.4; letter-spacing:-.015em; }
.p-approve-meta { font-size:12px; color:var(--muted); margin-top:6px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.p-approve-body {
  background:var(--surface2); border:1px solid var(--line); border-radius:var(--r-sm); padding:15px;
  font-size:13px; line-height:1.7; color:var(--text2); white-space:pre-wrap; word-break:break-word;
}
.p-approve-more { background:none; border:0; color:var(--accent); font-family:inherit; font-size:12.5px; font-weight:550; cursor:pointer; padding:9px 0 0; }
.p-approve-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:15px; flex-wrap:wrap; }
.p-approve-actions { display:flex; gap:8px; margin-left:auto; }
.p-approve-done { display:flex; align-items:center; gap:11px; padding:15px 20px; }
.p-approve-donetitle { font-size:13px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.p-cardlist { display:flex; flex-direction:column; gap:13px; }
.p-review-quote {
  background:var(--surface2); border-left:2px solid var(--line-strong); border-radius:0 var(--r-sm) var(--r-sm) 0;
  padding:12px 15px; font-size:12.5px; line-height:1.65; color:var(--muted); font-style:italic; margin-bottom:13px;
}
.p-reply-label { font-size:10.5px; font-weight:650; letter-spacing:.07em; text-transform:uppercase; color:var(--accent); margin-bottom:7px; }
.p-stars { color:var(--amber); font-size:12px; letter-spacing:1.5px; }

/* ── Empty / connect states ────────────────────────────────────────── */
.p-empty {
  border:1px dashed var(--line-strong); border-radius:var(--r-lg); padding:44px 26px; text-align:center;
  background:var(--surface2);
}
.p-empty-icon {
  width:44px; height:44px; margin:0 auto 14px; border-radius:12px; display:flex; align-items:center; justify-content:center;
  background:var(--surface); border:1px solid var(--line); color:var(--muted); font-size:19px; box-shadow:var(--shadow-xs);
}
.p-empty-title { font-size:14px; font-weight:600; color:var(--text); margin-bottom:6px; letter-spacing:-.012em; }
.p-empty-sub { font-size:12.5px; color:var(--muted); max-width:360px; margin:0 auto; line-height:1.65; }
.p-coming-badge {
  display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:600; letter-spacing:.05em;
  text-transform:uppercase; background:var(--surface2); color:var(--muted); border:1px solid var(--line);
  padding:3px 8px; border-radius:20px;
}
.p-subgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(252px,1fr)); gap:14px; }
.p-subcard {
  background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg); padding:20px;
  box-shadow:var(--shadow-xs); display:flex; flex-direction:column; gap:10px;
}
.p-subcard-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.p-subcard-icon { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; }
.p-subcard-title { font-size:14px; font-weight:600; margin:0; letter-spacing:-.014em; }
.p-subcard-desc { font-size:12.5px; color:var(--muted); line-height:1.65; margin:0; flex:1; }

/* ── Skeletons ─────────────────────────────────────────────────────── */
.p-skel {
  background:linear-gradient(90deg,var(--surface2) 25%,var(--surface3) 50%,var(--surface2) 75%);
  background-size:200% 100%; border-radius:var(--r); animation:pShimmer 1.6s ease-in-out infinite;
}

/* ── Layout helpers ────────────────────────────────────────────────── */
.p-2col { display:grid; grid-template-columns:1.38fr 1fr; gap:20px; align-items:start; }
@media (max-width:960px) { .p-2col { grid-template-columns:1fr; } }
.p-stack { display:flex; flex-direction:column; gap:20px; min-width:0; }

/* ── Home hero ─────────────────────────────────────────────────────── */
.p-home { display:flex; flex-direction:column; gap:20px; }
.p-hero-card {
  position:relative; overflow:hidden; background:var(--hero-glow), var(--surface);
  border:1px solid var(--line); border-radius:var(--r-xl); padding:32px 34px;
  display:flex; align-items:center; justify-content:space-between; gap:30px;
  box-shadow:var(--shadow); flex-wrap:wrap;
}
.p-hero-card .p-h1 { font-size:31px; letter-spacing:-.032em; }
.p-hero-greet { font-size:12.5px; font-weight:500; color:var(--muted); margin-bottom:8px; letter-spacing:-.005em; }
.p-site-card {
  display:flex; align-items:center; justify-content:space-between; text-decoration:none;
  color:var(--text); font-weight:550; font-size:13px; padding:17px 20px; letter-spacing:-.01em;
}
.p-site-card:hover { border-color:var(--accent-line); color:var(--accent); }
.p-ministat-row { display:flex; gap:11px; }
.p-ministat { flex:1; text-align:center; background:var(--surface2); border-radius:var(--r-sm); padding:15px 8px; }
.p-ministat-n { font-size:22px; font-weight:640; letter-spacing:-.028em; font-variant-numeric:tabular-nums; }
.p-ministat-label { font-size:11.5px; color:var(--muted); margin-top:4px; }
@media (max-width:560px) {
  .p-hero-card { flex-direction:column; align-items:flex-start; padding:26px 22px; }
  .p-hero-card .p-h1 { font-size:26px; }
}

/* ── Settings ──────────────────────────────────────────────────────── */
.p-deflist { margin:0; display:flex; flex-direction:column; }
.p-def { display:flex; gap:18px; padding:14px 0; border-bottom:1px solid var(--line); flex-wrap:wrap; }
.p-def:last-child { border-bottom:0; padding-bottom:0; }
.p-def:first-child { padding-top:0; }
.p-def dt { font-size:12.5px; color:var(--muted); font-weight:500; min-width:158px; }
.p-def dd { margin:0; font-size:13.5px; flex:1; min-width:200px; word-break:break-word; color:var(--text2); }
.p-conn-list { display:flex; flex-direction:column; }
.p-conn { display:flex; align-items:flex-start; gap:13px; padding:17px 0; border-bottom:1px solid var(--line); flex-wrap:wrap; }
.p-conn:last-child { border-bottom:0; padding-bottom:0; }
.p-conn:first-child { padding-top:0; }
.p-conn-dot { width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:var(--surface2); color:var(--muted2); flex-shrink:0; border:1px solid var(--line); }
.p-conn-dot.on { background:var(--green-soft); color:var(--green); border-color:transparent; }
.p-conn-name { font-size:13.5px; font-weight:600; letter-spacing:-.012em; }
.p-conn-desc { font-size:12.5px; color:var(--muted); margin-top:3px; line-height:1.6; }
.p-conn-detail { display:inline-block; margin-top:7px; font-family:'JetBrains Mono',monospace; font-size:10.5px; background:var(--surface2); border:1px solid var(--line); padding:2px 8px; border-radius:6px; color:var(--muted); }

/* ── AI Assistant chat ─────────────────────────────────────────────── */
.p-assistant-page { height:calc(100vh - 196px); min-height:540px; }
.p-chat { flex:1; display:flex; flex-direction:column; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-xl); box-shadow:var(--shadow); overflow:hidden; min-height:0; }
.p-chat-scroll { flex:1; overflow-y:auto; padding:26px; display:flex; flex-direction:column; gap:18px; }
.p-chat-welcome { margin:auto; text-align:center; max-width:540px; padding:20px 0; }
.p-chat-welcome-icon {
  width:48px; height:48px; margin:0 auto 16px; border-radius:14px; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(140deg,var(--accent),var(--accent2)); color:#fff;
  box-shadow:0 6px 20px var(--accent-soft), inset 0 1px 0 rgba(255,255,255,.2);
}
.p-chat-welcome-title { font-size:20px; font-weight:640; margin:0 0 8px; letter-spacing:-.025em; }
.p-chat-welcome-sub { font-size:13.5px; color:var(--muted); line-height:1.65; margin:0 0 22px; }
.p-chat-suggestions { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
.p-chat-suggestion {
  background:var(--surface); border:1px solid var(--line); color:var(--text2); padding:9px 14px;
  border-radius:20px; font-family:inherit; font-size:12.5px; cursor:pointer; text-align:left;
  box-shadow:var(--shadow-xs); transition:border-color .16s, color .16s;
}
.p-chat-suggestion:hover { border-color:var(--accent-line); color:var(--accent); }
.p-msg { display:flex; gap:11px; align-items:flex-start; }
.p-msg.user { justify-content:flex-end; }
.p-msg-avatar { width:28px; height:28px; border-radius:9px; background:var(--accent-soft); color:var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; border:1px solid var(--accent-line); }
.p-msg-bubble { max-width:min(680px,80%); padding:13px 16px; border-radius:14px; font-size:13.5px; line-height:1.7; white-space:pre-wrap; word-break:break-word; }
.p-msg.assistant .p-msg-bubble { background:var(--surface2); border:1px solid var(--line); border-top-left-radius:5px; color:var(--text2); }
.p-msg.user .p-msg-bubble { background:linear-gradient(180deg,var(--accent2),var(--accent)); color:#fff; border-top-right-radius:5px; box-shadow:var(--shadow-xs); }
.p-msg-typing { display:flex; gap:5px; align-items:center; padding:16px; }
.p-msg-typing span { width:6px; height:6px; border-radius:50%; background:var(--muted2); animation:pPulse 1.2s infinite; }
.p-msg-typing span:nth-child(2) { animation-delay:.18s; }
.p-msg-typing span:nth-child(3) { animation-delay:.36s; }
.p-chat-error { font-size:12.5px; color:var(--red); background:var(--red-soft); padding:11px 14px; border-radius:10px; }
.p-chat-input-row { display:flex; gap:10px; padding:15px; border-top:1px solid var(--line); background:var(--surface); }
@media (max-width:960px) { .p-assistant-page { height:calc(100vh - 150px); } .p-msg-bubble { max-width:88%; } }

/* ── Report ────────────────────────────────────────────────────────── */
.p-report { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-xl); padding:36px; box-shadow:var(--shadow-xs); }
.p-report-head { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; border-bottom:1px solid var(--line-strong); padding-bottom:22px; margin-bottom:26px; flex-wrap:wrap; }
.p-report-title { font-size:22px; font-weight:640; margin:0 0 5px; letter-spacing:-.028em; }
.p-report-period { font-size:12.5px; color:var(--muted); }
.p-report-section { margin-bottom:28px; }
.p-report-section h3 { font-size:11px; font-weight:650; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin:0 0 13px; }
@media print {
  .p-side, .p-topbar, .p-scrim, .p-pagehead, .p-subnav, .p-preview, .p-no-print { display:none !important; }
  .p-main { padding:0 !important; max-width:none !important; }
  .portal { background:#fff !important; }
  .p-report { border:0; box-shadow:none; padding:0; }
  .p-report-section { break-inside:avoid; }
}

@media (prefers-reduced-motion: reduce) {
  .portal *, .portal *::before, .portal *::after {
    animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important;
  }
}
`;
