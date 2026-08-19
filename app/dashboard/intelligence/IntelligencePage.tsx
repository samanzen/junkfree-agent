"use client";
import { useState } from "react";
import { down } from "@/lib/ui/tokens";
import { REPORT_RANGES, type ReportRangeDays } from "@/lib/intelligence/reportRange";
import IntelOverview from "./IntelOverview";
import KeywordTable from "./KeywordTable";
import WinnersLosers from "./WinnersLosers";
import PositionDistribution from "./PositionDistribution";
import CompetitorPanel from "./CompetitorPanel";
import ReportAskBar from "./ReportAskBar";

type Props = { brandId: string; brandName?: string };

type Section = "overview" | "keywords" | "winners" | "distribution" | "competitors";

const SECTIONS: { key: Section; label: string; blurb: string }[] = [
  { key: "overview", label: "Overview", blurb: "Clicks, impressions, and rankings — where you were vs where you are." },
  { key: "keywords", label: "Keywords", blurb: "Every search term we track, with current position and change." },
  { key: "winners", label: "What changed", blurb: "Plain-English report of rankings that moved up, down, or appeared." },
  { key: "distribution", label: "Visibility", blurb: "How many keywords sit on page 1, almost page 1, or further back." },
  { key: "competitors", label: "Competitors", blurb: "Side-by-side comparison of you vs rivals on shared keywords." },
];

export default function IntelligencePage({ brandId, brandName }: Props) {
  const [section, setSection] = useState<Section>("overview");
  const [days, setDays] = useState<ReportRangeDays>(30);
  const active = SECTIONS.find((s) => s.key === section);

  return (
    <div className="ip">
      <style>{CSS}</style>

      <header className="rp-head">
        <div>
          <h2 className="rp-title">Reports</h2>
          <p className="rp-sub">
            {brandName ? `${brandName} — ` : ""}
            The AI runs your SEO. This is the report of what happened. Spot something odd? Ask the AI below.
          </p>
        </div>
        <div className="rp-range" role="group" aria-label="Report period">
          {REPORT_RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              className={`rp-range-btn ${days === r.days ? "on" : ""}`}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <ReportAskBar brandId={brandId} />

      <div className="ip-nav" role="tablist" aria-label="Report sections">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={section === s.key}
            className={`ip-nav-btn ${section === s.key ? "on" : ""}`}
            onClick={() => setSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {active && <p className="rp-section-blurb">{active.blurb}</p>}

      <div className="ip-content">
        {section === "overview" && <IntelOverview brandId={brandId} brandName={brandName} days={days} />}
        {section === "keywords" && <KeywordTable brandId={brandId} />}
        {section === "winners" && <WinnersLosers brandId={brandId} days={days} />}
        {section === "distribution" && <PositionDistribution brandId={brandId} days={days} />}
        {section === "competitors" && <CompetitorPanel brandId={brandId} />}
      </div>
    </div>
  );
}

const CSS = `
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }
@keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }

.ip { display:flex; flex-direction:column; gap:0; }
.rp-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:14px; }
.rp-title { margin:0 0 4px; font-size:20px; letter-spacing:-.02em; color:#12172A; }
.rp-sub { margin:0; font-size:13.5px; color:#6B768D; max-width:54ch; line-height:1.5; }
.rp-range { display:flex; gap:4px; flex-wrap:wrap; background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-sm); padding:4px; }
.rp-range-btn { border:0; background:transparent; color:#6B768D; padding:7px 12px; border-radius:var(--radius-sm); font-size:12.5px; font-weight:600; cursor:pointer; font-family:inherit; }
.rp-range-btn.on { background:#EEF2FF; color:#4F46E5; }
.rp-section-blurb { margin:0 0 14px; font-size:13px; color:#6B768D; }

.rab { margin-bottom:16px; }
.rab-toggle { border:1px solid #E0E7FF; background:linear-gradient(135deg,#F8F7FF,#EEF2FF); color:#4338CA; border-radius:var(--radius-sm); padding:10px 14px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
.rab-panel { margin-top:10px; background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:14px; box-shadow:var(--shadow-1); }
.rab-hint { margin:0 0 10px; font-size:12.5px; color:#6B768D; line-height:1.45; }
.rab-suggestions { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
.rab-chip { border:1px solid #E7EAF0; background:#F9FAFB; color:#3D4654; border-radius:var(--radius-full); padding:6px 11px; font-size:12px; cursor:pointer; font-family:inherit; }
.rab-msgs { display:flex; flex-direction:column; gap:8px; max-height:240px; overflow:auto; margin-bottom:10px; }
.rab-msg { font-size:13px; line-height:1.5; padding:10px 12px; border-radius:var(--radius-sm); max-width:92%; white-space:pre-wrap; }
.rab-msg.user { align-self:flex-end; background:#EEF2FF; color:#312E81; }
.rab-msg.assistant { align-self:flex-start; background:#F3F5F8; color:#1A2030; }
.rab-err { color:#DD3535; font-size:12.5px; margin:0 0 8px; }
.rab-compose { display:flex; gap:8px; align-items:stretch; }
.rab-compose > *:first-child { flex:1; min-width:0; }
.rab-send { background:#4F46E5; color:#fff; border:0; border-radius:var(--radius-sm); padding:0 16px; font-weight:600; font-size:13px; cursor:pointer; font-family:inherit; }
.rab-send:disabled { opacity:.5; cursor:default; }

.ip-nav { display:flex; gap:2px; overflow-x:auto; border-bottom:1px solid var(--line,#E7EAF0); margin-bottom:10px; }
.ip-nav-btn { background:transparent; border:0; border-bottom:2px solid transparent; color:var(--muted,#8A93A6); padding:10px 14px; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; margin-bottom:-1px; }
.ip-nav-btn:hover { color:var(--text,#1A2030); }
.ip-nav-btn.on { color:#4F46E5; border-bottom-color:#4F46E5; }
.ip-content { min-height:300px; }

.io { display:flex; flex-direction:column; gap:16px; }
.io-story { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:18px 20px; box-shadow:var(--shadow-1); }
.io-story h3 { margin:0 0 6px; font-size:15px; color:#12172A; }
.io-story p { margin:0; font-size:13.5px; color:#4A5568; line-height:1.55; }
.io-period { font-size:12px; color:#8A93A6; margin-bottom:12px; }
.io-hero { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.io-hero-card { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:16px; box-shadow:var(--shadow-1); position:relative; overflow:hidden; }
.io-hero-card::before { content:""; position:absolute; top:0; left:0; right:0; height:3px; background:var(--accent,#4F46E5); }
.io-hero-label { font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#8A93A6; margin-bottom:8px; }
.io-hero-val { font-size:28px; font-weight:700; letter-spacing:-.03em; color:#12172A; line-height:1.1; }
.io-hero-was { font-size:12.5px; color:#6B768D; margin-top:8px; }
.io-hero-delta { display:inline-block; margin-top:6px; font-size:12px; font-weight:700; padding:2px 8px; border-radius:var(--radius-full); }
.io-hero-delta.g { color:#00856B; background:rgba(0,184,148,.12); }
.io-hero-delta.b { color:#C0392B; background:rgba(225,75,75,.1); }
.io-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.io-card { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:14px 16px; box-shadow:var(--shadow-1); }
.io-label { font-size:11px; font-weight:600; color:#8A93A6; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; display:flex; align-items:center; gap:4px; }
.io-val { font-size:22px; font-weight:700; letter-spacing:-.02em; }
.io-foot { min-height:18px; margin-top:6px; }
.io-delta { font-size:11px; font-weight:600; padding:2px 8px; border-radius:var(--radius-full); }
.io-delta.g { color:#00B894; background:rgba(0,184,148,.1); }
.io-delta.b { color:#FF6B6B; background:rgba(255,107,107,.1); }
.io-status-row { display:flex; gap:8px; flex-wrap:wrap; }
.io-status-chip { font-size:11.5px; font-weight:600; border:1px solid; padding:4px 12px; border-radius:var(--radius-full); }
.io-skeleton { padding:4px 0; }
.io-skel-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.io-skel-card { height:110px; background:linear-gradient(90deg,#F0F2F5,#E7EAF0,#F0F2F5); background-size:200%; border-radius:var(--radius-md); animation:shimmer 1.4s infinite; }
.io-empty { text-align:center; padding:60px 20px; color:#8A93A6; }
.io-empty h3 { font-size:18px; margin:0 0 8px; color:#1A2030; }

.wl { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); overflow:hidden; }
.wl-intro { padding:16px 18px 0; font-size:13.5px; color:#4A5568; line-height:1.5; }
.wl-tabs { display:flex; border-bottom:1px solid #E7EAF0; overflow-x:auto; margin-top:12px; }
.wl-tab { background:transparent; border:0; border-bottom:2px solid transparent; color:#8A93A6; padding:12px 16px; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; margin-bottom:-1px; display:flex; align-items:center; gap:6px; }
.wl-count { font-size:11px; background:#F0F2F5; color:#6A7280; padding:1px 6px; border-radius:var(--radius-xs); }
.wl-list { display:flex; flex-direction:column; }
.wl-row { display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid #F5F7FA; gap:12px; }
.wl-row:last-child { border-bottom:0; }
.wl-row-left { display:flex; flex-direction:column; gap:4px; flex:1; min-width:0; }
.wl-kw { font-size:14px; font-weight:600; color:#1A2030; }
.wl-vol { font-size:12px; color:#9AA3B2; }
.wl-plain { font-size:12.5px; color:#4A5568; line-height:1.4; }
.wl-reason { font-size:12px; color:#4F46E5; }
.wl-row-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
.wl-pos { font-size:12px; background:#F0F2F5; color:#6A7280; padding:4px 8px; border-radius:var(--radius-xs); font-weight:600; }
.wl-change { font-size:13px; font-weight:700; min-width:36px; text-align:right; }
.wl-empty, .wl-loading,
.pd-loading, .pd-empty,
.kt-empty,
.air-empty { padding:40px; text-align:center; color:#9AA3B2; font-size:13px; }

.pd { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:20px; }
.pd-headline { margin:0 0 6px; font-size:15px; color:#12172A; }
.pd-explain { margin:0 0 16px; font-size:13.5px; color:#4A5568; line-height:1.55; max-width:60ch; }
.pd-breakdown { display:flex; flex-direction:column; gap:12px; }
.pd-bar-row { display:flex; align-items:center; gap:12px; }
.pd-bar-label { width:140px; font-size:12.5px; font-weight:600; color:#3D4654; flex-shrink:0; }
.pd-bar-track { flex:1; height:10px; background:#F0F2F5; border-radius:var(--radius-xs); overflow:hidden; }
.pd-bar-fill { height:100%; border-radius:var(--radius-xs); transition:width var(--dur-4) var(--ease-out); }
.pd-bar-count { width:64px; text-align:right; font-size:12px; font-weight:700; color:#3D4654; }
.pd-chart-label { font-size:11px; color:#9AA3B2; margin:18px 0 8px; text-transform:uppercase; letter-spacing:.06em; font-weight:600; }

.kt { display:flex; flex-direction:column; gap:0; }
.kt-toolbar { display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap:wrap; }
.kt-search-wrap { flex:1; min-width:160px; }
.kt-search { width:100%; background:#fff; border:1px solid #E7EAF0; color:#1A2030; padding:8px 12px; border-radius:var(--radius-sm); font-size:13px; font-family:inherit; }
.kt-search:focus { outline:none; border-color:#4F46E5; }
.kt-filter { background:#fff; border:1px solid #E7EAF0; color:#6A7280; padding:8px 12px; border-radius:var(--radius-sm); font-size:13px; font-family:inherit; cursor:pointer; }
.kt-add { display:flex; gap:6px; }
.kt-add-btn { background:#4F46E5; color:#fff; border:0; padding:8px 14px; border-radius:var(--radius-sm); font-size:13px; font-weight:700; cursor:pointer; }
.kt-count { font-size:12px; color:#9AA3B2; white-space:nowrap; margin-left:auto; }
.kt-scroll { overflow-x:auto; border:1px solid #E7EAF0; border-radius:var(--radius-md); }
.kt-table { width:100%; border-collapse:collapse; min-width:700px; }
.kt-sort { background:none; border:0; padding:0; font:inherit; color:inherit; cursor:pointer; display:inline-flex; align-items:center; gap:4px; user-select:none; }
.kt-sort:hover { color:#4F46E5; }
.kt-sort-arrow { color:#4F46E5; min-width:9px; display:inline-block; }
.kt-row { cursor:pointer; }
.kt-th { padding:10px 12px; text-align:left; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#8A93A6; border-bottom:1px solid #E7EAF0; background:#F9FAFB; white-space:nowrap; }
.kt-row:hover td { background:#FAFBFF; }
.kt-td { padding:12px 12px; font-size:13px; border-bottom:1px solid #F5F7FA; color:#1A2030; }
.kt-kw { font-weight:600; }
.kt-center { text-align:center; }
.kt-pos-badge { font-size:12px; font-weight:700; padding:2px 8px; border-radius:var(--radius-full); }
.kt-intent-badge { font-size:11px; font-weight:600; padding:2px 8px; border-radius:var(--radius-full); }
.kt-status { font-size:11px; font-weight:600; padding:2px 8px; border-radius:var(--radius-full); }
.kt-dash { color:#C4CAD4; }
.kt-skel-row { padding:0; }
.kt-skel { height:44px; background:linear-gradient(90deg,#F9FAFB,#F0F2F5,#F9FAFB); background-size:200%; animation:shimmer 1.4s infinite; }
.kt-pages { display:flex; align-items:center; gap:12px; padding:14px 0 0; }
.kt-page-btn { background:#fff; border:1px solid #E7EAF0; color:#6A7280; padding:8px 14px; border-radius:var(--radius-sm); font-size:12.5px; cursor:pointer; }
.kt-page-btn:disabled { opacity:.45; cursor:default; }
.kt-page-info { font-size:12.5px; color:#9AA3B2; }

.kd { position:fixed; top:0; right:0; bottom:0; width:min(480px,96vw); background:#fff; border-left:1px solid #E7EAF0; z-index:201; box-shadow:var(--shadow-4); display:flex; flex-direction:column; animation:slideIn .25s ease; overflow-y:auto; }
.kd-head { display:flex; justify-content:space-between; align-items:flex-start; padding:20px 20px 14px; border-bottom:1px solid #E7EAF0; }
.kd-kw { font-size:17px; font-weight:700; color:#1A2030; margin-bottom:4px; }
.kd-sub { font-size:12.5px; color:#8A93A6; }
.kd-close { background:transparent; border:1px solid #E7EAF0; color:#9AA3B2; width:30px; height:30px; border-radius:var(--radius-sm); cursor:pointer; font-size:14px; flex-shrink:0; }
.kd-mtabs { display:flex; align-items:center; border-bottom:1px solid #E7EAF0; padding:0 20px; gap:2px; flex-wrap:wrap; }
.kd-mtab { background:transparent; border:0; border-bottom:2px solid transparent; color:#8A93A6; padding:10px 10px; font-size:13px; font-weight:600; cursor:pointer; margin-bottom:-1px; }
.kd-range { margin-left:auto; display:flex; gap:4px; }
.kd-rbtn { background:#F0F2F5; border:0; color:#6A7280; padding:4px 8px; border-radius:var(--radius-xs); font-size:11.5px; cursor:pointer; }
.kd-rbtn.on { background:#4F46E5; color:#fff; }
.kd-loading,.kd-empty { padding:40px 20px; text-align:center; color:#9AA3B2; font-size:13px; }
.kd-meta { padding:16px 20px; border-top:1px solid #E7EAF0; }
.kd-meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
.kd-meta-item { display:flex; flex-direction:column; gap:4px; }
.kd-meta-label { font-size:11px; font-weight:600; text-transform:uppercase; color:#9AA3B2; letter-spacing:.06em; }
.kd-meta-val { font-size:13.5px; font-weight:600; color:#1A2030; }
.kd-ai-reason { font-size:13px; color:#3730A3; background:#F8F7FF; border:1px solid #E0E7FF; border-radius:var(--radius-sm); padding:10px 12px; line-height:1.5; }
.kd-actions { display:flex; gap:8px; padding:16px 20px; border-top:1px solid #E7EAF0; flex-wrap:wrap; }

.cp { display:flex; flex-direction:column; gap:16px; }
.cp-intro { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:16px 18px; font-size:13.5px; color:#4A5568; line-height:1.5; }
.cp-add { display:flex; gap:8px; flex-wrap:wrap; }
.cp-input-wrap { flex:1; min-width:180px; }
.cp-input { width:100%; background:#fff; border:1px solid #E7EAF0; color:#1A2030; padding:10px 14px; border-radius:var(--radius-sm); font-size:13px; font-family:inherit; }
.cp-input:focus { outline:none; border-color:#4F46E5; }
.cp-add-btn { background:#4F46E5; color:#fff; border:0; padding:10px 18px; border-radius:var(--radius-sm); font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; white-space:nowrap; }
.cp-list { display:flex; flex-direction:column; gap:8px; }
.cp-row { display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:14px 16px; gap:12px; }
.cp-row.active { border-color:#4F46E5; background:#FAFBFF; }
.cp-check { width:18px; height:18px; accent-color:#4F46E5; }
.cp-domain { font-size:14px; font-weight:600; color:#1A2030; }
.cp-meta { font-size:12px; color:#9AA3B2; margin-top:2px; }
.cp-gap-btn { background:#EEF2FF; color:#4F46E5; border:0; padding:8px 12px; border-radius:var(--radius-sm); font-size:12.5px; font-weight:600; cursor:pointer; }
.cp-remove { background:transparent; border:1px solid #E7EAF0; color:#C4CAD4; width:28px; height:28px; border-radius:var(--radius-xs); cursor:pointer; font-size:13px; }
.cp-empty { padding:30px; text-align:center; color:#9AA3B2; font-size:13px; }
.cp-report { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:18px; }
.cp-report h4 { margin:0 0 4px; font-size:15px; color:#12172A; }
.cp-report p { margin:0 0 14px; font-size:13px; color:#6B768D; line-height:1.45; }
.cp-table { width:100%; border-collapse:collapse; }
.cp-table th { text-align:left; font-size:10.5px; font-weight:700; text-transform:uppercase; color:#9AA3B2; padding:8px 10px; border-bottom:1px solid #E7EAF0; }
.cp-table td { padding:10px 10px; font-size:13px; border-bottom:1px solid #F5F7FA; }
.cp-kw { font-weight:500; }
.cp-pos { background:#FFF3CD; color:#D97706; font-size:12px; font-weight:700; padding:2px 8px; border-radius:var(--radius-full); }
.cp-pos.win { background:rgba(0,184,148,.12); color:#00856B; }
.cp-pos.lose { background:rgba(225,75,75,.1); color:#C0392B; }
.cp-track-btn { background:#EEF2FF; color:#4F46E5; border:0; padding:4px 12px; border-radius:var(--radius-xs); font-size:12px; font-weight:600; cursor:pointer; }
.cp-compare-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:4px; }

${down.md} {
  .io-hero{grid-template-columns:repeat(2,1fr)}
  .io-grid{grid-template-columns:repeat(2,1fr)}
  .io-skel-grid{grid-template-columns:repeat(2,1fr)}
}
${down.sm} {
  .io-hero,.io-grid,.io-skel-grid{grid-template-columns:1fr}
  .kt-toolbar{flex-direction:column} .kt-search,.kt-add{width:100%}
  .ip-nav{overflow-x:auto;scrollbar-width:none}
  .ip-nav::-webkit-scrollbar{display:none}
  .ip-nav-btn{white-space:nowrap;flex:0 0 auto}
  .pd-bar-label{width:110px}
  .rp-head{flex-direction:column}
}

${down.md} {
  .kd {
    top:auto; right:0; left:0; bottom:0;
    width:100%; max-height:88vh;
    border-left:0; border-top:1px solid #E7EAF0;
    border-radius:var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow:var(--shadow-4);
    animation:sheetUp .28s cubic-bezier(.32,.72,0,1);
    padding-bottom:env(safe-area-inset-bottom);
  }
  .kd::before {
    content:""; position:sticky; top:0; z-index:2;
    display:block; width:38px; height:4px; margin:8px auto 2px;
    background:#D8DCE4; border-radius:var(--radius-full); flex:none;
  }
  .kd-head { padding-top:10px; }
  .kd-mtabs { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; }
  .kd-mtabs::-webkit-scrollbar { display:none; }
  .kd-mtab { white-space:nowrap; flex:0 0 auto; }
  .kd-range { margin-left:8px; flex:0 0 auto; }
  .kd-meta-grid { grid-template-columns:1fr; }
}
@keyframes sheetUp { from{transform:translateY(100%)} to{transform:none} }
.kd-close { display:grid; place-items:center; }
.kd-rbtn { display:inline-flex; align-items:center; justify-content:center; }
`;
