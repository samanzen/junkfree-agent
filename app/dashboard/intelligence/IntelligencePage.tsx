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
import ActivityReport from "./ActivityReport";
import DigestReport from "./DigestReport";

type Props = { brandId: string; brandName?: string };

type Section =
  | "overview"
  | "keywords"
  | "winners"
  | "distribution"
  | "activity"
  | "digest"
  | "competitors";

const SECTIONS: { key: Section; label: string; blurb: string }[] = [
  { key: "overview", label: "Overview", blurb: "Clicks, impressions, and rankings — where you were vs where you are." },
  { key: "keywords", label: "Keywords", blurb: "Rank tracking: position, change, volume, difficulty, and the exact URL ranking." },
  { key: "winners", label: "What changed", blurb: "Moved up, slipped, newly ranking, stopped ranking, and almost page 1." },
  { key: "distribution", label: "Visibility", blurb: "Where your keywords sit — Top 3, Top 10, Top 100, plus almost page 1." },
  { key: "activity", label: "AI work", blurb: "Pages published, drafts finished, and keywords the agents worked on." },
  { key: "digest", label: "Digest", blurb: "Colorful weekly/monthly postcard — what customers will get by email later." },
  { key: "competitors", label: "Competitors", blurb: "Track rivals, compare organic traffic, and see keyword gaps and backlinks." },
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
            Reports only: what happened. Fix / push actions are in AI Recommendations. Spot something odd? Ask the AI below.
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
        {section === "keywords" && <KeywordTable brandId={brandId} days={days} />}
        {section === "winners" && <WinnersLosers brandId={brandId} days={days} />}
        {section === "distribution" && <PositionDistribution brandId={brandId} days={days} />}
        {section === "activity" && <ActivityReport brandId={brandId} days={days} />}
        {section === "digest" && <DigestReport brandId={brandId} brandName={brandName} days={days} />}
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
.wl-cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-bottom:4px; }
.wl-card { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:14px 16px; }
.wl-card.up { border-color:#BBF7D0; background:linear-gradient(180deg,#F0FDF4,#fff); }
.wl-card.down { border-color:#FECACA; background:linear-gradient(180deg,#FEF2F2,#fff); }
.wl-card.flat { border-color:#E7EAF0; }
.wl-card-label { font-size:12px; font-weight:600; color:#6B768D; }
.wl-card-n { margin-top:6px; font-size:28px; font-weight:700; color:#12172A; letter-spacing:-.03em; display:flex; align-items:center; gap:8px; }
.wl-card.up .wl-card-n { color:#059669; }
.wl-card.down .wl-card-n { color:#DC2626; }
.wl-card-n span { font-size:16px; }
.wl-tabs { display:flex; border-bottom:1px solid #E7EAF0; overflow-x:auto; margin-top:12px; }
.wl-tab { background:transparent; border:0; border-bottom:2px solid transparent; color:#8A93A6; padding:12px 16px; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; margin-bottom:-1px; display:flex; align-items:center; gap:6px; }
.wl-count { font-size:11px; background:#F0F2F5; color:#6A7280; padding:1px 6px; border-radius:var(--radius-xs); }
.wl-list { display:flex; flex-direction:column; }
.wl-row { display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid #F5F7FA; gap:16px; }
.wl-row:last-child { border-bottom:0; }
.wl-row-left { display:flex; flex-direction:column; gap:4px; flex:1; min-width:0; }
.wl-row-right { flex-shrink:0; }
.wl-kw { font-size:14px; font-weight:700; color:#FF6A3D; }
.wl-vol { font-size:12px; color:#9AA3B2; }
.wl-plain { font-size:12.5px; color:#64748B; line-height:1.4; }
.wl-meta-row { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:2px; }
.wl-url { font-size:12px; color:#0984E3; text-decoration:none; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.wl-url:hover { text-decoration:underline; }
.wl-empty, .wl-loading,
.pd-loading, .pd-empty,
.kt-empty,
.air-empty { padding:40px; text-align:center; color:#9AA3B2; font-size:13px; }

.pd { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:20px; }
.pd-headline { margin:0 0 6px; font-size:15px; color:#12172A; }
.pd-explain { margin:0 0 16px; font-size:13.5px; color:#4A5568; line-height:1.55; max-width:60ch; }
.pd-grid { display:grid; grid-template-columns:1.4fr .9fr; gap:14px; }
.pd-panel { background:#FAFBFC; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:16px; }
.pd-panel-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#8A93A6; margin-bottom:8px; }
.pd-pie-wrap { display:grid; grid-template-columns:1fr 140px; gap:8px; align-items:center; }
.pd-pie-legend { display:flex; flex-direction:column; gap:8px; }
.pd-leg { display:flex; align-items:center; gap:8px; font-size:12.5px; color:#3D4654; }
.pd-leg-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.pd-leg-label { flex:1; }
.pd-leg-n { font-weight:700; font-variant-numeric:tabular-nums; }
.pd-almost { background:linear-gradient(180deg,#FFF8EB,#fff); border-color:#F5D9A0; }
.pd-almost-n { font-size:42px; font-weight:700; color:#D97706; letter-spacing:-.04em; line-height:1; }
.pd-almost-copy { margin:10px 0 0; font-size:13px; color:#6B768D; line-height:1.5; }
.pd-chart-label { font-size:11px; color:#9AA3B2; margin:0 0 8px; text-transform:uppercase; letter-spacing:.06em; font-weight:600; }

.kt { display:flex; flex-direction:column; gap:14px; }
.kt-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
.kt-title { margin:0; font-size:20px; font-weight:700; color:#12172A; letter-spacing:-.02em; }
.kt-sub { margin:4px 0 0; font-size:13.5px; color:#6B768D; }
.kt-count-pill { background:#FFF4EF; color:#FF6A3D; font-size:12px; font-weight:700; padding:6px 10px; border-radius:var(--radius-full); }
.kt-cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
.kt-card { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:14px 16px; }
.kt-card.up { border-color:#BBF7D0; background:linear-gradient(180deg,#F0FDF4,#fff); }
.kt-card.down { border-color:#FECACA; background:linear-gradient(180deg,#FEF2F2,#fff); }
.kt-card.almost { border-color:#F5D9A0; background:linear-gradient(180deg,#FFF8EB,#fff); }
.kt-card-label { font-size:12px; font-weight:600; color:#6B768D; }
.kt-card-n { margin-top:6px; font-size:28px; font-weight:700; color:#12172A; letter-spacing:-.03em; display:flex; align-items:center; gap:8px; }
.kt-card.up .kt-card-n { color:#059669; }
.kt-card.down .kt-card-n { color:#DC2626; }
.kt-card.almost .kt-card-n { color:#D97706; }
.kt-card-arrow { font-size:14px; }
.kt-card-hint { margin-top:4px; font-size:11px; color:#9AA3B2; line-height:1.35; }
.kt-buckets { display:flex; flex-wrap:wrap; gap:12px; align-items:center; font-size:12.5px; color:#4A5568; }
.kt-bucket { display:inline-flex; align-items:center; gap:6px; background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-full); padding:5px 10px; }
.kt-bucket i { width:8px; height:8px; border-radius:50%; display:inline-block; }
.kt-bucket b { font-variant-numeric:tabular-nums; }
.kt-bucket-note { font-size:11.5px; color:#9AA3B2; }
.kt-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.kt-btn { border:0; padding:9px 14px; border-radius:var(--radius-sm); font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; white-space:nowrap; }
.kt-btn-primary { background:#FF6A3D; color:#fff; }
.kt-btn-ghost { background:#fff; color:#4A5568; border:1px solid #E7EAF0; }
.kt-search-wrap { flex:1; min-width:160px; }
.kt-search { width:100%; background:#fff; border:1px solid #E7EAF0; color:#1A2030; padding:8px 12px; border-radius:var(--radius-sm); font-size:13px; font-family:inherit; }
.kt-search:focus { outline:none; border-color:#FF6A3D; }
.kt-filter { background:#fff; border:1px solid #E7EAF0; color:#6A7280; padding:8px 12px; border-radius:var(--radius-sm); font-size:13px; font-family:inherit; cursor:pointer; }
.kt-add { display:flex; gap:6px; }
.kt-add-btn { background:#FF6A3D; color:#fff; border:0; padding:8px 14px; border-radius:var(--radius-sm); font-size:13px; font-weight:700; cursor:pointer; }
.kt-table-card { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); overflow:hidden; }
.kt-table-label { padding:12px 16px; font-size:13px; font-weight:700; color:#12172A; border-bottom:1px solid #E7EAF0; background:#FAFBFC; }
.kt-table { width:100%; border-collapse:collapse; min-width:760px; }
.kt-sort { background:none; border:0; padding:0; font:inherit; color:inherit; cursor:pointer; display:inline-flex; align-items:center; gap:4px; user-select:none; }
.kt-sort:hover { color:#FF6A3D; }
.kt-sort-arrow { color:#FF6A3D; min-width:9px; display:inline-block; }
.kt-tip { display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; margin-left:2px; border-radius:50%; background:#EEF1F6; color:#9AA3B2; font-size:10px; font-weight:700; cursor:help; }
.kt-row { cursor:pointer; }
.kt-th { padding:10px 12px; text-align:left; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#8A93A6; border-bottom:1px solid #E7EAF0; background:#F9FAFB; white-space:nowrap; }
.kt-row:hover td { background:#FFF9F6; }
.kt-td { padding:12px 12px; font-size:13px; border-bottom:1px solid #F5F7FA; color:#1A2030; vertical-align:middle; }
.kt-kw { font-weight:700; color:#FF6A3D; }
.kt-kw-meta { margin-top:2px; font-size:11.5px; color:#9AA3B2; text-transform:capitalize; }
.kt-center { text-align:center; }
.kt-pos-badge { font-size:12px; font-weight:700; padding:3px 9px; border-radius:var(--radius-full); }
.kt-diff { display:flex; align-items:center; gap:6px; font-size:12px; color:#6A7280; }
.kt-diff-track { width:40px; height:5px; background:#EEF0F4; border-radius:3px; overflow:hidden; }
.kt-diff-fill { height:100%; border-radius:3px; }
.kt-diff-when { color:#00B894; font-weight:700; }
.kt-url { color:#0984E3; text-decoration:none; font-size:12.5px; max-width:220px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.kt-url:hover { text-decoration:underline; }
.kt-dash { color:#C4CAD4; }
.kt-skel-row { padding:0; }
.kt-skel { height:44px; background:linear-gradient(90deg,#F9FAFB,#F0F2F5,#F9FAFB); background-size:200%; animation:shimmer 1.4s infinite; }
.kt-pages { display:flex; align-items:center; gap:12px; padding:4px 0 0; }
.kt-page-btn { background:#fff; border:1px solid #E7EAF0; color:#6A7280; padding:8px 14px; border-radius:var(--radius-sm); font-size:12.5px; cursor:pointer; }
.kt-page-btn:disabled { opacity:.45; cursor:default; }
.kt-page-info { font-size:12.5px; color:#9AA3B2; }

.kd { position:fixed; top:0; right:0; bottom:0; width:min(480px,96vw); background:#fff; border-left:1px solid #E7EAF0; z-index:201; box-shadow:var(--shadow-4); display:flex; flex-direction:column; animation:slideIn .25s ease; overflow-y:auto; }
.kd-head { display:flex; justify-content:space-between; align-items:flex-start; padding:20px 20px 14px; border-bottom:1px solid #E7EAF0; }
.kd-kw { font-size:17px; font-weight:700; color:#FF6A3D; margin-bottom:4px; }
.kd-sub { font-size:12.5px; color:#8A93A6; }
.kd-rank { padding:12px 20px; border-bottom:1px solid #E7EAF0; display:flex; justify-content:flex-end; }
.kd-close { background:transparent; border:1px solid #E7EAF0; color:#9AA3B2; width:30px; height:30px; border-radius:var(--radius-sm); cursor:pointer; font-size:14px; flex-shrink:0; }
.kd-mtabs { display:flex; align-items:center; border-bottom:1px solid #E7EAF0; padding:0 20px; gap:2px; flex-wrap:wrap; }
.kd-mtab { background:transparent; border:0; border-bottom:2px solid transparent; color:#8A93A6; padding:10px 10px; font-size:13px; font-weight:600; cursor:pointer; margin-bottom:-1px; }
.kd-range { margin-left:auto; display:flex; gap:4px; }
.kd-rbtn { background:#F0F2F5; border:0; color:#6A7280; padding:4px 8px; border-radius:var(--radius-xs); font-size:11.5px; cursor:pointer; }
.kd-rbtn.on { background:#FF6A3D; color:#fff; }
.kd-loading,.kd-empty { padding:40px 20px; text-align:center; color:#9AA3B2; font-size:13px; }
.kd-meta { padding:16px 20px; border-top:1px solid #E7EAF0; }
.kd-meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
.kd-meta-item { display:flex; flex-direction:column; gap:4px; }
.kd-meta-label { font-size:11px; font-weight:600; text-transform:uppercase; color:#9AA3B2; letter-spacing:.06em; }
.kd-meta-val { font-size:13.5px; font-weight:600; color:#1A2030; }
.kd-ai-reason { font-size:13px; color:#9A3412; background:#FFF8F4; border:1px solid #FFD8C8; border-radius:var(--radius-sm); padding:10px 12px; line-height:1.5; }
.kd-actions { display:flex; gap:8px; padding:16px 20px; border-top:1px solid #E7EAF0; flex-wrap:wrap; }

.cp { display:flex; flex-direction:column; gap:16px; }
.cp-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
.cp-title { margin:0; font-size:20px; font-weight:700; color:#12172A; letter-spacing:-.02em; }
.cp-sub { margin:4px 0 0; font-size:13.5px; color:#6B768D; }
.cp-head-actions { display:flex; gap:8px; flex-wrap:wrap; }
.cp-add { display:flex; gap:8px; flex-wrap:wrap; }
.cp-input-wrap { flex:1; min-width:180px; }
.cp-input { width:100%; background:#fff; border:1px solid #E7EAF0; color:#1A2030; padding:10px 14px; border-radius:var(--radius-sm); font-size:13px; font-family:inherit; }
.cp-input:focus { outline:none; border-color:#FF6A3D; }
.cp-btn { border:0; padding:10px 16px; border-radius:var(--radius-sm); font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; white-space:nowrap; }
.cp-btn:disabled { opacity:.55; cursor:not-allowed; }
.cp-btn-primary { background:#FF6A3D; color:#fff; }
.cp-btn-primary:hover:not(:disabled) { background:#E85A2E; }
.cp-btn-blue { background:#0984E3; color:#fff; }
.cp-btn-ghost { background:#fff; color:#4A5568; border:1px solid #E7EAF0; }
.cp-btn-danger { background:#fff; color:#C0392B; border:1px solid #F5C6C2; }
.cp-status { font-size:13px; color:#4A5568; }
.cp-hint { background:#FFF8F4; border:1px solid #FFD8C8; color:#9A3412; border-radius:var(--radius-md); padding:12px 14px; font-size:13px; line-height:1.45; }
.cp-card { background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:18px; }
.cp-card-head { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.cp-card-head h4 { margin:0; font-size:15px; font-weight:700; color:#12172A; }
.cp-you-pill { font-size:12px; font-weight:600; color:#FF6A3D; background:#FFF4EF; padding:4px 10px; border-radius:var(--radius-full); }
.cp-chart { width:100%; min-height:280px; }
.cp-table-actions { display:flex; gap:8px; flex-wrap:wrap; }
.cp-table { width:100%; border-collapse:collapse; }
.cp-table th { text-align:left; font-size:10.5px; font-weight:700; text-transform:uppercase; color:#9AA3B2; padding:10px 10px; border-bottom:1px solid #E7EAF0; letter-spacing:.04em; }
.cp-table td { padding:12px 10px; font-size:13px; border-bottom:1px solid #F5F7FA; vertical-align:middle; color:#1A2030; }
.cp-table tr.selected td { background:#FFF9F6; }
.cp-check-col { width:36px; }
.cp-check-field { margin:0; }
.cp-check-field .fld-control { display:flex; align-items:center; }
.cp-check-field input { width:16px; height:16px; accent-color:#FF6A3D; }
.cp-domain-cell { display:flex; align-items:center; gap:8px; }
.cp-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.cp-domain { font-weight:600; color:#1A2030; }
.cp-metric-cell { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.cp-view-all { background:#FFF4EF; color:#FF6A3D; border:0; padding:4px 10px; border-radius:var(--radius-xs); font-size:11.5px; font-weight:700; cursor:pointer; font-family:inherit; }
.cp-view-all:hover { background:#FFE8DC; }
.cp-view-all.on { background:#FF6A3D; color:#fff; }
.cp-num { font-variant-numeric:tabular-nums; font-weight:600; }
.cp-empty { padding:30px; text-align:center; color:#9AA3B2; font-size:13px; }
.cp-tip { display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; margin-left:4px; border-radius:50%; background:#EEF1F6; color:#9AA3B2; font-size:10px; font-weight:700; cursor:help; vertical-align:middle; }
.cp-expand-row td { padding:0 !important; background:#FAFBFC; border-bottom:1px solid #E7EAF0; }
.cp-expand { padding:14px 16px 16px; }
.cp-expand-tabs { display:flex; gap:6px; margin-bottom:12px; }
.cp-tab { background:#F5F7FA; color:#6B768D; border:0; padding:8px 12px; border-radius:var(--radius-sm); font-size:12.5px; font-weight:600; cursor:pointer; font-family:inherit; }
.cp-tab.on { background:#FF6A3D; color:#fff; }
.cp-kw-table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-sm); overflow:hidden; }
.cp-kw-table th { text-align:left; font-size:10.5px; font-weight:700; text-transform:uppercase; color:#9AA3B2; padding:10px 12px; border-bottom:1px solid #E7EAF0; letter-spacing:.04em; background:#FBFBFC; }
.cp-kw-table td { padding:12px; font-size:13px; border-bottom:1px solid #F5F7FA; vertical-align:top; color:#1A2030; }
.cp-kw { font-weight:600; color:#1A2030; }
.cp-kw-url { display:inline-block; margin-top:3px; font-size:11.5px; color:#0984E3; text-decoration:none; max-width:360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cp-kw-url:hover { text-decoration:underline; }
.cp-expand-foot { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-top:14px; }
.cp-pager { display:flex; gap:4px; flex-wrap:wrap; }
.cp-page { min-width:28px; height:28px; border:1px solid #E7EAF0; background:#fff; color:#4A5568; border-radius:var(--radius-xs); font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; }
.cp-page.on { background:#FF6A3D; border-color:#FF6A3D; color:#fff; }
.cp-expand-actions { display:flex; gap:8px; flex-wrap:wrap; }

${down.md} {
  .io-hero{grid-template-columns:repeat(2,1fr)}
  .io-grid{grid-template-columns:repeat(2,1fr)}
  .io-skel-grid{grid-template-columns:repeat(2,1fr)}
}
${down.md} {
  .act-hero,.dig-stats,.act-cols{grid-template-columns:repeat(2,1fr)}
}
${down.sm} {
  .io-hero,.io-grid,.io-skel-grid,.act-hero,.dig-stats,.act-cols{grid-template-columns:1fr}
  .kt-toolbar{flex-direction:column} .kt-search,.kt-add{width:100%}
  .kt-cards,.wl-cards{grid-template-columns:1fr 1fr}
  .pd-grid,.pd-pie-wrap{grid-template-columns:1fr}
  .ip-nav{overflow-x:auto;scrollbar-width:none}
  .ip-nav::-webkit-scrollbar{display:none}
  .ip-nav-btn{white-space:nowrap;flex:0 0 auto}
  .rp-head{flex-direction:column}
  .dig-stat{border-right:0;border-bottom:1px solid #EEF0F4}
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


/* ── Colorful report polish ── */
.ip { background:linear-gradient(180deg,#F4F7FF 0%,#F6F8FB 120px,#F6F8FB 100%); margin:0 -8px; padding:8px 8px 24px; border-radius:var(--radius-md); }
.rp-title { background:linear-gradient(120deg,#4F46E5,#0891B2); -webkit-background-clip:text; background-clip:text; color:transparent; }
.rp-range { background:linear-gradient(135deg,#fff,#EEF2FF); box-shadow:var(--shadow-1); }
.rp-range-btn.on { background:linear-gradient(135deg,#4F46E5,#6366F1); color:#fff; }
.ip-nav-btn.on { color:#4F46E5; border-bottom-color:#4F46E5; }
.io-story { background:linear-gradient(135deg,#EEF2FF,#ECFEFF); border-color:#C7D2FE; }
.io-hero-card { border:0; box-shadow:var(--shadow-2); }
.wl { border:0; box-shadow:var(--shadow-2); overflow:hidden; }
.wl-intro { background:linear-gradient(90deg,#F0FDF4,#EEF2FF); margin:0 !important; padding:14px 18px !important; }
.wl-row.tone-gains { border-left:4px solid #00B894; background:linear-gradient(90deg,#F0FDF9,#fff 35%); }
.wl-row.tone-drops { border-left:4px solid #E17055; background:linear-gradient(90deg,#FFF5F2,#fff 35%); }
.wl-row.tone-new { border-left:4px solid #6C5CE7; background:linear-gradient(90deg,#F5F3FF,#fff 35%); }
.wl-row.tone-lost { border-left:4px solid #94A3B8; }
.wl-row.tone-page1 { border-left:4px solid #F5A623; background:linear-gradient(90deg,#FFF8EB,#fff 35%); }
.pd { border:0; box-shadow:var(--shadow-2); background:linear-gradient(180deg,#fff,#F8FAFF); }

.act { display:flex; flex-direction:column; gap:16px; }
.act-hero { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.act-hero-card { border-radius:var(--radius-md); padding:18px 16px; color:#fff; box-shadow:var(--shadow-2); }
.act-hero-card.c1 { background:linear-gradient(145deg,#0EA5E9,#0369A1); }
.act-hero-card.c2 { background:linear-gradient(145deg,#8B5CF6,#5B21B6); }
.act-hero-card.c3 { background:linear-gradient(145deg,#10B981,#047857); }
.act-hero-card.c4 { background:linear-gradient(145deg,#F59E0B,#B45309); }
.act-hero-n { font-size:32px; font-weight:700; letter-spacing:-.03em; }
.act-hero-l { font-size:12.5px; opacity:.92; margin-top:4px; }
.act-types h3,.act-panel h3 { margin:0 0 10px; font-size:15px; color:#12172A; }
.act-type-row { display:flex; flex-wrap:wrap; gap:8px; }
.act-type-chip { background:#EEF2FF; color:#3730A3; border-radius:var(--radius-full); padding:6px 12px; font-size:12.5px; }
.act-cols { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.act-panel { background:#fff; border-radius:var(--radius-md); padding:16px 18px; box-shadow:var(--shadow-1); border:1px solid #E7EAF0; }
.act-panel.teal { border-top:3px solid #0EA5E9; }
.act-panel.violet { border-top:3px solid #8B5CF6; }
.act-panel.amber { border-top:3px solid #F59E0B; }
.act-panel ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
.act-panel li { display:flex; justify-content:space-between; gap:10px; font-size:13px; }
.act-panel li span { color:#8A93A6; white-space:nowrap; }
.act-muted { color:#8A93A6; font-size:13px; margin:0; }
.act-pub-list li { align-items:center; }
.act-badge { background:#FEF3C7; color:#92400E; font-size:11px; font-weight:700; padding:3px 8px; border-radius:var(--radius-full); }
.act-date { color:#8A93A6; font-size:12px; }
.act-loading,.act-empty,.dig-loading { padding:40px; text-align:center; color:#8A93A6; }

.dig-card { border-radius:var(--radius-lg); overflow:hidden; box-shadow:var(--shadow-3); background:#fff; }
.dig-banner { background:linear-gradient(125deg,#4F46E5 0%,#0891B2 55%,#10B981 100%); color:#fff; padding:28px 24px; }
.dig-eyebrow { font-size:11px; letter-spacing:.12em; text-transform:uppercase; opacity:.85; margin-bottom:8px; }
.dig-banner h2 { margin:0 0 6px; font-size:26px; letter-spacing:-.02em; }
.dig-banner p { margin:0; opacity:.92; font-size:14px; max-width:48ch; }
.dig-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:0; }
.dig-stat { padding:18px 16px; border-right:1px solid #EEF0F4; }
.dig-stat:last-child { border-right:0; }
.dig-stat.a { background:#EFF6FF; }
.dig-stat.b { background:#ECFDF5; }
.dig-stat.c { background:#F5F3FF; }
.dig-stat.d { background:#FFFBEB; }
.dig-stat-n { font-size:26px; font-weight:700; color:#12172A; letter-spacing:-.02em; }
.dig-stat-l { font-size:12px; color:#6B768D; margin-top:4px; }
.dig-delta { margin-top:6px; font-size:12px; font-weight:700; }
.dig-delta.up { color:#059669; }
.dig-delta.down { color:#DC2626; }
.dig-body { padding:20px 24px 24px; }
.dig-body h3 { margin:0 0 10px; font-size:15px; }
.dig-body ul { margin:0; padding-left:18px; color:#3D4654; font-size:13.5px; line-height:1.6; }
.dig-note { margin:14px 0 0; font-size:12.5px; color:#8A93A6; line-height:1.45; }
`;
