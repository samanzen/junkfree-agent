"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { Panel, PanelHead } from "../../_components/Panel";
import StatTile from "../../_components/StatTile";
import EmptyState from "../../_components/EmptyState";
import MultiLineChart from "../../_components/MultiLineChart";
import { Stagger } from "../../_components/motion";

type Overview = {
  top_3: number | null; top_10: number | null; top_20: number | null;
  top_50: number | null; top_100: number | null; not_ranked: number | null;
  total_clicks: number | null; total_impressions: number | null; avg_ctr: number | null;
  avg_position: number | null; total_keywords: number | null;
  deltas: Record<string, number | null>;
  by_status: Record<string, number>;
  has_data: boolean;
  status: "no_gsc" | "never_synced" | "syncing" | "ok";
};
type DistRow = {
  captured_date: string;
  top_3: number | null; top_10: number | null; top_20: number | null; top_50: number | null;
};

const STATUS_COPY: Record<string, { title: string; sub: string; icon: string }> = {
  no_gsc: {
    title: "Search Console isn't connected yet",
    sub: "Once your Google Search Console property is linked, your keyword rankings appear here automatically.",
    icon: "🔗",
  },
  never_synced: {
    title: "Waiting for your first ranking sync",
    sub: "Search Console is connected. Your keyword data will appear after the next daily sync.",
    icon: "◷",
  },
  syncing: {
    title: "Your rankings are syncing",
    sub: "We've started collecting position data. Full distribution appears once the first snapshot completes.",
    icon: "⟳",
  },
};

export default function OverviewTab({ brandId }: { brandId: string }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [dist, setDist] = useState<DistRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      authedFetch(`/api/intelligence/overview?brand=${brandId}`).then((r) => r.json()),
      authedFetch(`/api/intelligence/distribution?brand=${brandId}&days=60`).then((r) => r.json()),
    ])
      .then(([o, d]) => {
        if (cancelled) return;
        setOv(o); setDist(d.distribution || []); setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  if (loading) {
    return (
      <div className="p-stack">
        <div className="p-skel" style={{ height: 150 }} />
        <div className="p-skel" style={{ height: 300 }} />
      </div>
    );
  }

  if (!ov || (ov.status && ov.status !== "ok" && !ov.has_data)) {
    const copy = STATUS_COPY[ov?.status || "never_synced"] || STATUS_COPY.never_synced;
    return <EmptyState icon={copy.icon} title={copy.title} sub={copy.sub} />;
  }

  const chartData = dist.map((r) => ({
    date: new Date(r.captured_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    top_3: r.top_3 ?? 0, top_10: r.top_10 ?? 0, top_20: r.top_20 ?? 0, top_50: r.top_50 ?? 0,
  }));

  return (
    <div className="p-stack">
      <Panel>
        <PanelHead title="Where you rank" sub="How many of your keywords sit in each position band today." />
        <Stagger className="p-stat-grid">
          <StatTile label="Top 3" value={fmt(ov.top_3)} tone="green" sub={deltaText(ov.deltas?.top_3)} />
          <StatTile label="Top 10" value={fmt(ov.top_10)} tone="accent" sub={deltaText(ov.deltas?.top_10)} />
          <StatTile label="Top 20" value={fmt(ov.top_20)} tone="amber" sub={deltaText(ov.deltas?.top_20)} />
          <StatTile label="Top 50" value={fmt(ov.top_50)} tone="blue" />
          <StatTile label="Total keywords" value={fmt(ov.total_keywords)} tone="muted" />
          <StatTile label="Avg. position" value={ov.avg_position != null ? ov.avg_position.toFixed(1) : "—"} tone="pink" />
        </Stagger>
      </Panel>

      <div className="p-2col">
        <Panel>
          <PanelHead title="Ranking distribution over time" sub="Last 60 days." />
          {chartData.length > 1 ? (
            <MultiLineChart
              data={chartData}
              series={[
                { key: "top_3", name: "Top 3", color: "var(--green)" },
                { key: "top_10", name: "Top 10", color: "var(--accent)" },
                { key: "top_20", name: "Top 20", color: "var(--amber)" },
                { key: "top_50", name: "Top 50", color: "var(--blue)" },
              ]}
            />
          ) : (
            <EmptyState icon="📊" title="Not enough history yet" sub="This chart fills in as daily ranking snapshots accumulate." />
          )}
        </Panel>

        <div className="p-stack">
          <Panel>
            <PanelHead title="Search performance" sub="From Google Search Console." />
            <Stagger className="p-stat-grid">
              <StatTile label="Clicks" value={fmt(ov.total_clicks)} tone="green" sub={deltaText(ov.deltas?.total_clicks)} />
              <StatTile label="Impressions" value={fmt(ov.total_impressions)} tone="accent" sub={deltaText(ov.deltas?.total_impressions)} />
              <StatTile label="Avg. CTR" value={ov.avg_ctr != null ? `${(ov.avg_ctr * 100).toFixed(1)}%` : "—"} tone="blue" />
            </Stagger>
          </Panel>

          <Panel>
            <PanelHead title="This week" />
            <Stagger className="p-stat-grid">
              <StatTile label="New" value={fmt(ov.deltas?.new_this_week)} tone="green" />
              <StatTile label="Improved" value={fmt(ov.deltas?.improved_this_week)} tone="accent" />
              <StatTile label="Declined" value={fmt(ov.deltas?.declined_this_week)} tone="amber" />
              <StatTile label="Lost" value={fmt(ov.deltas?.lost_this_week)} tone="red" />
            </Stagger>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number | null | undefined) {
  return n == null ? "—" : n.toLocaleString();
}
function deltaText(d: number | null | undefined): string | undefined {
  if (d == null || d === 0) return undefined;
  return `${d > 0 ? "+" : ""}${d} vs last`;
}
