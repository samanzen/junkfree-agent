"use client";
import { useState } from "react";
import { down } from "@/lib/ui/tokens";
import IntelOverview from "./IntelOverview";
import KeywordTable from "./KeywordTable";
import WinnersLosers from "./WinnersLosers";
import PositionDistribution from "./PositionDistribution";
import AIRecommendations from "./AIRecommendations";
import CompetitorPanel from "./CompetitorPanel";

type Props = { brandId: string; brandName?: string };

type Section = "overview" | "keywords" | "winners" | "distribution" | "recommendations" | "competitors";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "overview",        label: "Overview" },
  { key: "keywords",        label: "Keywords" },
  { key: "winners",         label: "Winners & Losers" },
  { key: "distribution",    label: "Distribution" },
  { key: "recommendations", label: "AI Recommendations" },
  { key: "competitors",     label: "Competitors" },
];

export default function IntelligencePage({ brandId, brandName }: Props) {
  const [section, setSection] = useState<Section>("overview");

  return (
    <div className="ip">
      <style>{CSS}</style>

      {/* Section nav */}
      <div className="ip-nav">
        {SECTIONS.map((s) => (
          <button key={s.key} className={`ip-nav-btn ${section === s.key ? "on" : ""}`}
            onClick={() => setSection(s.key)}>{s.label}</button>
        ))}
      </div>

      {/* Content */}
      <div className="ip-content">
        {section === "overview"        && <IntelOverview brandId={brandId} brandName={brandName} />}
        {section === "keywords"        && <KeywordTable brandId={brandId} />}
        {section === "winners"         && <WinnersLosers brandId={brandId} />}
        {section === "distribution"    && <PositionDistribution brandId={brandId} />}
        {section === "recommendations" && <AIRecommendations brandId={brandId} />}
        {section === "competitors"     && <CompetitorPanel brandId={brandId} />}
      </div>
    </div>
  );
}

const CSS = `
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }
@keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }

/* ── Intelligence Page Shell ── */
.ip { display:flex; flex-direction:column; gap:0; }
.ip-nav { display:flex; gap:2px; overflow-x:auto; border-bottom:1px solid var(--line,#E7EAF0); margin-bottom:22px; }
.ip-nav-btn { background:transparent; border:0; border-bottom:2px solid transparent; color:var(--muted,#8A93A6); padding:10px 14px; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; margin-bottom:-1px; }
.ip-nav-btn:hover { color:var(--text,#1A2030); }
.ip-nav-btn.on { color:#6C5CE7; border-bottom-color:#6C5CE7; }
.ip-content { min-height:300px; }

/* ── IntelOverview ── */
.io { display:flex; flex-direction:column; gap:14px; }
.io-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; }
.io-card { background:#fff; border:1px solid #E7EAF0; border-radius:14px; padding:16px 16px 12px; box-shadow:0 1px 3px rgba(16,24,40,.04); position:relative; overflow:hidden; animation:prise .45s ease both; }
@keyframes prise { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
.io-card-accent { position:absolute; top:0; left:0; right:0; height:3px; border-radius:14px 14px 0 0; }
.io-label { font-size:11px; font-weight:600; color:#8A93A6; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; display:flex; align-items:center; gap:4px; }
.io-val { font-size:26px; font-weight:700; letter-spacing:-.02em; line-height:1.1; }
.io-foot { min-height:18px; margin-top:6px; }
.io-delta { font-size:11px; font-weight:600; padding:2px 7px; border-radius:20px; }
.io-delta.g { color:#00B894; background:rgba(0,184,148,.1); }
.io-delta.b { color:#FF6B6B; background:rgba(255,107,107,.1); }
.io-status-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:4px; }
.io-status-chip { font-size:11.5px; font-weight:600; border:1px solid; padding:4px 11px; border-radius:20px; }
.io-skeleton { padding:4px 0; }
.io-skel-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; }
.io-skel-card { height:95px; background:linear-gradient(90deg,#F0F2F5,#E7EAF0,#F0F2F5); background-size:200%; border-radius:14px; animation:shimmer 1.4s infinite; }
.io-empty { text-align:center; padding:60px 20px; color:#8A93A6; }
.io-empty h3 { font-size:18px; margin:0 0 8px; color:#1A2030; }

/* ── Winners/Losers ── */
.wl { background:#fff; border:1px solid #E7EAF0; border-radius:16px; overflow:hidden; }
.wl-tabs { display:flex; border-bottom:1px solid #E7EAF0; overflow-x:auto; }
.wl-tab { background:transparent; border:0; border-bottom:2px solid transparent; color:#8A93A6; padding:12px 16px; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; margin-bottom:-1px; display:flex; align-items:center; gap:6px; }
.wl-count { font-size:11px; background:#F0F2F5; color:#6A7280; padding:1px 6px; border-radius:10px; }
.wl-list { display:flex; flex-direction:column; }
.wl-row { display:flex; justify-content:space-between; align-items:center; padding:13px 18px; border-bottom:1px solid #F5F7FA; gap:12px; }
.wl-row:last-child { border-bottom:0; }
.wl-row-left { display:flex; flex-direction:column; gap:3px; flex:1; min-width:0; }
.wl-kw { font-size:13.5px; font-weight:600; color:#1A2030; }
.wl-vol { font-size:11.5px; color:#9AA3B2; }
.wl-reason { font-size:11.5px; color:#6C5CE7; font-style:italic; }
.wl-row-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
.wl-pos { font-size:12px; background:#F0F2F5; color:#6A7280; padding:3px 9px; border-radius:8px; font-weight:600; }
.wl-change { font-size:13px; font-weight:700; min-width:36px; text-align:right; }
.wl-empty { padding:40px; text-align:center; color:#9AA3B2; font-size:13px; }
.wl-loading { padding:40px; text-align:center; color:#9AA3B2; font-size:13px; }

/* ── Position Distribution ── */
.pd { background:#fff; border:1px solid #E7EAF0; border-radius:16px; padding:20px; }
.pd-breakdown { display:flex; flex-direction:column; gap:10px; }
.pd-bar-row { display:flex; align-items:center; gap:12px; }
.pd-bar-label { width:80px; font-size:12px; font-weight:600; color:#6A7280; flex-shrink:0; }
.pd-bar-track { flex:1; height:8px; background:#F0F2F5; border-radius:4px; overflow:hidden; }
.pd-bar-fill { height:100%; border-radius:4px; transition:width .6s ease; }
.pd-bar-count { width:36px; text-align:right; font-size:12px; font-weight:700; }
.pd-chart-label { font-size:11px; color:#9AA3B2; margin-bottom:8px; text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
.pd-loading,.pd-empty { padding:40px; text-align:center; color:#9AA3B2; font-size:13px; }

/* ── Keyword Table ── */
.kt { display:flex; flex-direction:column; gap:0; }
.kt-toolbar { display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap:wrap; }
.kt-search { flex:1; min-width:160px; background:#fff; border:1px solid #E7EAF0; color:#1A2030; padding:9px 13px; border-radius:9px; font-size:13px; font-family:inherit; }
.kt-search:focus { outline:none; border-color:#6C5CE7; }
.kt-filter { background:#fff; border:1px solid #E7EAF0; color:#6A7280; padding:9px 13px; border-radius:9px; font-size:13px; font-family:inherit; cursor:pointer; }
.kt-add { display:flex; gap:6px; }
.kt-add-btn { background:#6C5CE7; color:#fff; border:0; padding:9px 14px; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; }
.kt-count { font-size:12px; color:#9AA3B2; white-space:nowrap; margin-left:auto; }
.kt-scroll { overflow-x:auto; border:1px solid #E7EAF0; border-radius:14px; }
.kt-table { width:100%; border-collapse:collapse; min-width:700px; }
.kt-th { padding:10px 12px; text-align:left; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#8A93A6; border-bottom:1px solid #E7EAF0; background:#F9FAFB; white-space:nowrap; }
.kt-row { cursor:pointer; }
.kt-row:hover td { background:#FAFBFF; }
.kt-td { padding:11px 12px; font-size:13px; border-bottom:1px solid #F5F7FA; color:#1A2030; }
.kt-kw { font-weight:600; }
.kt-center { text-align:center; }
.kt-pos-badge { font-size:12px; font-weight:700; padding:2px 9px; border-radius:20px; }
.kt-intent-badge { font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; }
.kt-status { font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; }
.kt-dash { color:#C4CAD4; }
.kt-empty { padding:40px; text-align:center; color:#9AA3B2; font-size:13px; }
.kt-skel-row { padding:0; }
.kt-skel { height:44px; background:linear-gradient(90deg,#F9FAFB,#F0F2F5,#F9FAFB); background-size:200%; animation:shimmer 1.4s infinite; }
.kt-pages { display:flex; align-items:center; gap:12px; padding:14px 0 0; }
.kt-page-btn { background:#fff; border:1px solid #E7EAF0; color:#6A7280; padding:7px 14px; border-radius:8px; font-size:12.5px; cursor:pointer; }
.kt-page-btn:disabled { opacity:.45; cursor:default; }
.kt-page-info { font-size:12.5px; color:#9AA3B2; }

/* ── Keyword Drawer ── */
.kd { position:fixed; top:0; right:0; bottom:0; width:min(480px,96vw); background:#fff; border-left:1px solid #E7EAF0; z-index:201; box-shadow:-8px 0 40px rgba(16,24,40,.12); display:flex; flex-direction:column; animation:slideIn .25s ease; overflow-y:auto; }
.kd-head { display:flex; justify-content:space-between; align-items:flex-start; padding:20px 20px 14px; border-bottom:1px solid #E7EAF0; }
.kd-kw { font-size:17px; font-weight:700; color:#1A2030; margin-bottom:4px; }
.kd-sub { font-size:12.5px; color:#8A93A6; }
.kd-close { background:transparent; border:1px solid #E7EAF0; color:#9AA3B2; width:30px; height:30px; border-radius:8px; cursor:pointer; font-size:14px; flex-shrink:0; }
.kd-mtabs { display:flex; align-items:center; border-bottom:1px solid #E7EAF0; padding:0 20px; gap:2px; flex-wrap:wrap; }
.kd-mtab { background:transparent; border:0; border-bottom:2px solid transparent; color:#8A93A6; padding:10px 10px; font-size:13px; font-weight:600; cursor:pointer; margin-bottom:-1px; }
.kd-range { margin-left:auto; display:flex; gap:3px; }
.kd-rbtn { background:#F0F2F5; border:0; color:#6A7280; padding:4px 9px; border-radius:6px; font-size:11.5px; cursor:pointer; }
.kd-rbtn.on { background:#6C5CE7; color:#fff; }
.kd-loading,.kd-empty { padding:40px 20px; text-align:center; color:#9AA3B2; font-size:13px; }
.kd-meta { padding:16px 20px; border-top:1px solid #E7EAF0; }
.kd-meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
.kd-meta-item { display:flex; flex-direction:column; gap:3px; }
.kd-meta-label { font-size:11px; font-weight:600; text-transform:uppercase; color:#9AA3B2; letter-spacing:.06em; }
.kd-meta-val { font-size:13.5px; font-weight:600; color:#1A2030; }
.kd-ai-reason { font-size:13px; color:#3730A3; background:#F8F7FF; border:1px solid #E0E7FF; border-radius:8px; padding:10px 12px; line-height:1.5; }
.kd-actions { display:flex; gap:8px; padding:16px 20px; border-top:1px solid #E7EAF0; flex-wrap:wrap; }

/* ── AI Recommendations ── */
.air-loading { display:flex; flex-direction:column; gap:12px; }
.air-skel { height:100px; background:linear-gradient(90deg,#F0F2F5,#E7EAF0,#F0F2F5); background-size:200%; border-radius:14px; animation:shimmer 1.4s infinite; }
.air-cats { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }
.air-cat { background:#fff; border:1px solid #E7EAF0; color:#8A93A6; padding:6px 13px; border-radius:20px; font-size:12.5px; font-weight:600; cursor:pointer; font-family:inherit; }
.air-card { background:#fff; border:1px solid #E7EAF0; border-radius:14px; display:flex; margin-bottom:12px; overflow:hidden; }
.air-card-bar { width:4px; flex-shrink:0; }
.air-card-body { padding:16px; flex:1; }
.air-card-head { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.air-cat-badge { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:.06em; }
.air-priority { font-size:11px; color:#9AA3B2; margin-left:auto; }
.air-dismiss { background:transparent; border:0; color:#C4CAD4; cursor:pointer; font-size:14px; padding:0; }
.air-title { font-size:14.5px; font-weight:700; color:#1A2030; margin:0 0 6px; }
.air-explanation { font-size:13px; color:#4A5568; line-height:1.6; margin:0 0 10px; }
.air-impact { font-size:12.5px; color:#6C5CE7; background:#F8F7FF; border-radius:7px; padding:7px 10px; margin-bottom:12px; }
.air-empty { padding:40px; text-align:center; color:#9AA3B2; font-size:13px; }

/* ── Competitors ── */
.cp { display:flex; flex-direction:column; gap:16px; }
.cp-add { display:flex; gap:8px; }
.cp-input { flex:1; background:#fff; border:1px solid #E7EAF0; color:#1A2030; padding:10px 14px; border-radius:10px; font-size:13px; font-family:inherit; }
.cp-input:focus { outline:none; border-color:#6C5CE7; }
.cp-add-btn { background:#6C5CE7; color:#fff; border:0; padding:10px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; white-space:nowrap; }
.cp-list { display:flex; flex-direction:column; gap:8px; }
.cp-row { display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #E7EAF0; border-radius:12px; padding:14px 16px; cursor:pointer; gap:12px; }
.cp-row.active { border-color:#6C5CE7; background:#FAFBFF; }
.cp-domain { font-size:14px; font-weight:600; color:#1A2030; }
.cp-meta { font-size:12px; color:#9AA3B2; margin-top:2px; }
.cp-gap-btn { background:#EEF2FF; color:#6C5CE7; border:0; padding:7px 13px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; }
.cp-remove { background:transparent; border:1px solid #E7EAF0; color:#C4CAD4; width:28px; height:28px; border-radius:7px; cursor:pointer; font-size:13px; }
.cp-empty { padding:30px; text-align:center; color:#9AA3B2; font-size:13px; }
.cp-gaps { background:#fff; border:1px solid #E7EAF0; border-radius:14px; padding:18px; }
.cp-gaps-title { font-size:15px; font-weight:700; color:#1A2030; margin:0 0 4px; }
.cp-gaps-sub { font-size:12.5px; color:#9AA3B2; margin:0 0 14px; }
.cp-table { width:100%; border-collapse:collapse; }
.cp-table th { text-align:left; font-size:10.5px; font-weight:700; text-transform:uppercase; color:#9AA3B2; padding:8px 10px; border-bottom:1px solid #E7EAF0; }
.cp-table td { padding:10px 10px; font-size:13px; border-bottom:1px solid #F5F7FA; }
.cp-kw { font-weight:500; }
.cp-pos { background:#FFF3CD; color:#D97706; font-size:12px; font-weight:700; padding:2px 9px; border-radius:20px; }
.cp-track-btn { background:#EEF2FF; color:#6C5CE7; border:0; padding:5px 11px; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; }

/* ── Responsive (Phase 1: consolidated onto the shared breakpoints) ───────── */
${down.md} { .io-grid{grid-template-columns:repeat(2,1fr)} }
${down.sm} {
  .io-grid{grid-template-columns:1fr}
  .kt-toolbar{flex-direction:column} .kt-search,.kt-add{width:100%}
  .ip-nav{overflow-x:auto;scrollbar-width:none}
  .ip-nav::-webkit-scrollbar{display:none}
  .ip-nav-btn{white-space:nowrap;flex:0 0 auto}
}

/* ══ Phase 1 foundation: the keyword drawer ═══════════════════════════════ */
/* Below the sidebar breakpoint the right-side full-height drawer becomes a
   bottom sheet — the reachable pattern on a phone, where the top of a
   full-height panel is furthest from the thumb. Above it, the drawer is
   unchanged. Dialog semantics (role, aria-modal, Escape, focus trap) are
   Phase 3; this is the geometry only. */
${down.md} {
  .kd {
    top:auto; right:0; left:0; bottom:0;
    width:100%; max-height:88vh;
    border-left:0; border-top:1px solid #E7EAF0;
    border-radius:18px 18px 0 0;
    box-shadow:0 -10px 44px rgba(16,24,40,.18);
    animation:sheetUp .28s cubic-bezier(.32,.72,0,1);
    padding-bottom:env(safe-area-inset-bottom);
  }
  /* Grab handle, so it reads as a dismissible sheet rather than a stuck panel. */
  .kd::before {
    content:""; position:sticky; top:0; z-index:2;
    display:block; width:38px; height:4px; margin:9px auto 2px;
    background:#D8DCE4; border-radius:99px; flex:none;
  }
  .kd-head { padding-top:10px; }
  .kd-mtabs { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; }
  .kd-mtabs::-webkit-scrollbar { display:none; }
  .kd-mtab { white-space:nowrap; flex:0 0 auto; }
  .kd-range { margin-left:8px; flex:0 0 auto; }
  .kd-meta-grid { grid-template-columns:1fr; }
}
@keyframes sheetUp { from{transform:translateY(100%)} to{transform:none} }

/* The close and range buttons were the two smallest controls in the product
   (30px and 24px). touchTargetCSS raises them on touch devices; these keep
   them visually balanced at the larger size. */
/* No touchTargetCSS() call here: this component renders inside the dashboard's
   .sr root, so app/dashboard/page.tsx's rules already cover every control on
   this page. Emitting them again would duplicate the whole block. */
.kd-close { display:grid; place-items:center; }
.kd-rbtn { display:inline-flex; align-items:center; justify-content:center; }
`;
