"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import CountUp from "@/app/dashboard/CountUp";
import MetricExplainer from "./MetricExplainer";
import ExecSummary from "./ExecSummary";
import DataStatus, { type DataStatusKind } from "./DataStatus";
import { SYSTEM, POSITIVE, ATTENTION, NEGATIVE, ACCENT_ALT, BRAND, MUTED } from "./palette";

type Overview = {
  top_3: number|null; top_10: number|null; top_20: number|null;
  top_50: number|null; top_100: number|null; not_ranked: number|null;
  total_clicks: number|null; total_impressions: number|null;
  avg_ctr: number|null; avg_position: number|null; total_keywords: number|null;
  deltas: Record<string, number|null>; by_status: Record<string, number>; has_data: boolean;
  status?: DataStatusKind;
};

const CARDS = [
  { key: "avg_position",    label: "Avg. Position",   suffix: "",  decimals: 1, invert: true,  color: SYSTEM, explainer: "avg_position" as const },
  { key: "total_keywords",  label: "Total Keywords",  suffix: "",  decimals: 0, invert: false, color: ACCENT_ALT, explainer: "top_10" as const },
  { key: "top_3",           label: "Top 3",           suffix: "",  decimals: 0, invert: false, color: POSITIVE, explainer: "top_3" as const },
  { key: "top_10",          label: "Top 10 (Page 1)", suffix: "",  decimals: 0, invert: false, color: POSITIVE, explainer: "top_10" as const },
  { key: "top_20",          label: "Top 20",          suffix: "",  decimals: 0, invert: false, color: ATTENTION, explainer: "striking_dist" as const },
  { key: "top_100",         label: "Top 100",         suffix: "",  decimals: 0, invert: false, color: "#A29BFE", explainer: "top_10" as const },
  { key: "total_clicks",    label: "Total Clicks",    suffix: "",  decimals: 0, invert: false, color: "#E17055", explainer: "ctr" as const },
  { key: "total_impressions",label: "Impressions",   suffix: "",  decimals: 0, invert: false, color: "#74B9FF", explainer: "top_10" as const },
  { key: "avg_ctr",         label: "Avg. CTR",        suffix: "%", decimals: 2, invert: false, color: BRAND, explainer: "ctr" as const },
  { key: "not_ranked",      label: "Not Ranked",      suffix: "",  decimals: 0, invert: true,  color: MUTED, explainer: "top_10" as const },
];

export default function IntelOverview({ brandId, brandName }: { brandId: string; brandName?: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    authedFetch(`/api/intelligence/overview?brand=${brandId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brandId]);

  if (loading) return <div className="io-skeleton"><div className="io-skel-grid">{[...Array(10)].map((_,i)=><div key={i} className="io-skel-card"/>)}</div></div>;

  if (!data?.has_data) return <DataStatus status={data?.status || "never_synced"} />;

  return (
    <div className="io">
      <ExecSummary brandId={brandId} section="overview" brandName={brandName} data={{ top_10: data.top_10, improved: data.deltas.improved_this_week, lost: data.deltas.lost_this_week }} />

      <div className="io-grid">
        {CARDS.map((c) => {
          const val = (data as Record<string, unknown>)[c.key] as number | null;
          const d = data.deltas?.[c.key] as number | null | undefined;
          const up = d != null && d !== 0 && d > 0;
          const good = c.invert ? !up : up;
          const displayVal = c.key === "avg_ctr" && val != null ? val * 100 : val;
          return (
            <div key={c.key} className="io-card">
              <div className="io-card-accent" style={{ background: c.color }} />
              <div className="io-label">{c.label} <MetricExplainer metric={c.explainer} /></div>
              <div className="io-val" style={{ color: c.color }}>
                <CountUp value={displayVal} decimals={c.decimals} suffix={c.suffix} />
              </div>
              <div className="io-foot">
                {d != null && d !== 0 && (
                  <span className={`io-delta ${good ? "g" : "b"}`}>{up ? "▲" : "▼"} {Math.abs(d).toLocaleString()}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status breakdown */}
      {Object.keys(data.by_status).length > 0 && (
        <div className="io-status-row">
          {[
            { key: "improving", label: "Improving", color: POSITIVE },
            { key: "stable",    label: "Stable",    color: ATTENTION },
            { key: "declining", label: "Declining", color: NEGATIVE },
            { key: "new",       label: "New",       color: SYSTEM },
            { key: "lost",      label: "Lost",      color: MUTED },
          ].filter((s) => data.by_status[s.key]).map((s) => (
            <div key={s.key} className="io-status-chip" style={{ borderColor: s.color, color: s.color }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, display: "inline-block", marginRight: 5 }} />
              {data.by_status[s.key]} {s.label}
            </div>
          ))}
          {data.deltas.new_this_week ? <div className="io-status-chip" style={{ borderColor: SYSTEM, color: SYSTEM }}>+{data.deltas.new_this_week} new this week</div> : null}
          {data.deltas.lost_this_week ? <div className="io-status-chip" style={{ borderColor: NEGATIVE, color: NEGATIVE }}>−{data.deltas.lost_this_week} lost this week</div> : null}
        </div>
      )}
    </div>
  );
}
