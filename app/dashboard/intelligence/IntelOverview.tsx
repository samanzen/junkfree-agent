"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import CountUp from "@/app/dashboard/CountUp";
import MetricExplainer from "./MetricExplainer";
import ExecSummary from "./ExecSummary";
import DataStatus, { type DataStatusKind } from "./DataStatus";

type Overview = {
  top_3: number | null;
  top_10: number | null;
  top_20: number | null;
  top_50: number | null;
  top_100: number | null;
  not_ranked: number | null;
  total_clicks: number | null;
  total_impressions: number | null;
  avg_ctr: number | null;
  avg_position: number | null;
  total_keywords: number | null;
  previous: {
    top_3: number | null;
    top_10: number | null;
    top_20: number | null;
    total_clicks: number | null;
    total_impressions: number | null;
    avg_ctr: number | null;
    captured_date: string;
  } | null;
  deltas: Record<string, number | null>;
  by_status: Record<string, number>;
  compared?: { current_date: string | null; previous_date: string | null; days: number };
  has_data: boolean;
  status?: DataStatusKind;
};

const SECONDARY = [
  { key: "avg_position", label: "Average Google position", decimals: 1, invert: true, explainer: "avg_position" as const },
  { key: "top_3", label: "Keywords in top 3", decimals: 0, invert: false, explainer: "top_3" as const },
  { key: "top_10", label: "Keywords on page 1", decimals: 0, invert: false, explainer: "top_10" as const },
  { key: "top_20", label: "Almost on page 1 (top 20)", decimals: 0, invert: false, explainer: "striking_dist" as const },
  { key: "avg_ctr", label: "Click-through rate", decimals: 2, invert: false, explainer: "ctr" as const, pct: true },
  { key: "total_keywords", label: "Keywords we track", decimals: 0, invert: false, explainer: "top_10" as const },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "earlier";
  return new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function buildStory(data: Overview): string {
  const clicks = data.total_clicks ?? 0;
  const imps = data.total_impressions ?? 0;
  const dClicks = data.deltas.total_clicks;
  const dImps = data.deltas.total_impressions;
  const improved = data.deltas.improved_this_week ?? 0;
  const declined = data.deltas.declined_this_week ?? 0;
  const parts: string[] = [];

  parts.push(
    `People saw your site about ${imps.toLocaleString()} times in Google, and clicked through ${clicks.toLocaleString()} times.`
  );
  if (dClicks != null && dClicks !== 0) {
    parts.push(
      dClicks > 0
        ? `That’s ${Math.abs(dClicks).toLocaleString()} more clicks than at the start of this period.`
        : `That’s ${Math.abs(dClicks).toLocaleString()} fewer clicks than at the start of this period.`
    );
  } else if (dImps != null && dImps !== 0) {
    parts.push(
      dImps > 0
        ? `You also showed up ${Math.abs(dImps).toLocaleString()} more times in search results.`
        : `You showed up ${Math.abs(dImps).toLocaleString()} fewer times in search results.`
    );
  }
  if (improved || declined) {
    parts.push(
      `On rankings: ${improved} search terms moved up` +
        (declined ? `, and ${declined} slipped.` : ".")
    );
  }
  return parts.join(" ");
}

export default function IntelOverview({
  brandId,
  brandName,
  days = 30,
}: {
  brandId: string;
  brandName?: string;
  days?: number;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    setLoading(true);
    authedFetch(`/api/intelligence/overview?brand=${brandId}&days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId, days]);

  if (loading) {
    return (
      <div className="io-skeleton">
        <div className="io-skel-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="io-skel-card" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.has_data) return <DataStatus status={data?.status || "never_synced"} />;

  const prev = data.previous;
  const hero = [
    {
      key: "total_impressions",
      label: "Times you appeared in Google",
      value: data.total_impressions,
      was: prev?.total_impressions,
      delta: data.deltas.total_impressions,
      invert: false,
      color: "#0984E3",
    },
    {
      key: "total_clicks",
      label: "Clicks to your site",
      value: data.total_clicks,
      was: prev?.total_clicks,
      delta: data.deltas.total_clicks,
      invert: false,
      color: "#00B894",
    },
    {
      key: "top_10",
      label: "Keywords on page 1",
      value: data.top_10,
      was: prev?.top_10,
      delta: data.deltas.top_10,
      invert: false,
      color: "#4F46E5",
    },
    {
      key: "top_20",
      label: "Almost on page 1",
      value: data.top_20 != null && data.top_10 != null ? Math.max(0, data.top_20 - data.top_10) : null,
      was:
        prev?.top_20 != null && prev?.top_10 != null ? Math.max(0, prev.top_20 - prev.top_10) : null,
      delta: null as number | null,
      invert: false,
      color: "#D97706",
    },
  ];

  return (
    <div className="io">
      <ExecSummary
        brandId={brandId}
        section="overview"
        brandName={brandName}
        data={{
          top_10: data.top_10,
          improved: data.deltas.improved_this_week,
          lost: data.deltas.lost_this_week,
          days,
        }}
      />

      <div className="io-story">
        <div className="io-period">
          Report period: {fmtDate(data.compared?.previous_date)} → {fmtDate(data.compared?.current_date)}
          {data.compared?.days ? ` · last ${data.compared.days} days` : ""}
        </div>
        <h3>What happened</h3>
        <p>{buildStory(data)}</p>
      </div>

      <div className="io-hero">
        {hero.map((h) => {
          const up = h.delta != null && h.delta !== 0 && h.delta > 0;
          const good = h.invert ? !up : up;
          return (
            <div key={h.key} className="io-hero-card" style={{ ["--accent" as string]: h.color }}>
              <div className="io-hero-label">{h.label}</div>
              <div className="io-hero-val">
                <CountUp value={h.value} decimals={0} />
              </div>
              {h.was != null && <div className="io-hero-was">Was {h.was.toLocaleString()} before</div>}
              {h.delta != null && h.delta !== 0 && (
                <span className={`io-hero-delta ${good ? "g" : "b"}`}>
                  {up ? "▲" : "▼"} {Math.abs(h.delta).toLocaleString()} vs start of period
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="io-grid">
        {SECONDARY.map((c) => {
          const raw = (data as Record<string, unknown>)[c.key] as number | null;
          const d = data.deltas?.[c.key] as number | null | undefined;
          const up = d != null && d !== 0 && d > 0;
          const good = c.invert ? !up : up;
          const displayVal = c.pct && raw != null ? raw * 100 : raw;
          return (
            <div key={c.key} className="io-card">
              <div className="io-label">
                {c.label} <MetricExplainer metric={c.explainer} />
              </div>
              <div className="io-val">
                <CountUp value={displayVal} decimals={c.decimals} suffix={c.pct ? "%" : ""} />
              </div>
              <div className="io-foot">
                {d != null && d !== 0 && (
                  <span className={`io-delta ${good ? "g" : "b"}`}>
                    {up ? "▲" : "▼"} {Math.abs(c.pct ? d * 100 : d).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(data.by_status).length > 0 && (
        <div className="io-status-row">
          {[
            { key: "improving", label: "Moving up", color: "#00B894" },
            { key: "stable", label: "Holding steady", color: "#D97706" },
            { key: "declining", label: "Slipping", color: "#FF6B6B" },
            { key: "new", label: "Newly tracked", color: "#4F46E5" },
            { key: "lost", label: "No longer ranking", color: "#B2BAC8" },
          ]
            .filter((s) => data.by_status[s.key])
            .map((s) => (
              <div key={s.key} className="io-status-chip" style={{ borderColor: s.color, color: s.color }}>
                {data.by_status[s.key]} {s.label}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
