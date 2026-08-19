"use client";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { authedFetch } from "@/lib/authedFetch";
import DataStatus, { type DataStatusKind } from "./DataStatus";
import { useChartTouch } from "@/lib/ui/useChartTouch";

type Snap = {
  captured_date: string;
  top_3: number;
  top_10: number;
  top_20: number;
  top_50: number;
  top_100: number;
  not_ranked: number;
  total_clicks: number;
};

const PIE_COLORS = {
  top3: "#00CEC9",
  top10: "#F1C40F",
  top100: "#74B9FF",
  none: "#FD79A8",
};

export default function PositionDistribution({
  brandId,
  days = 30,
}: {
  brandId: string;
  days?: number;
}) {
  const t = useChartTouch();
  const [data, setData] = useState<Snap[]>([]);
  const [status, setStatus] = useState<DataStatusKind>("ok");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    setLoading(true);
    Promise.all([
      authedFetch(`/api/intelligence/distribution?brand=${brandId}&days=${days}`).then((r) => r.json()),
      authedFetch(`/api/intelligence/overview?brand=${brandId}&days=${days}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([d, ov]) => {
        setData(d.distribution || []);
        setStatus(ov?.status || "ok");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId, days]);

  const latest = data[data.length - 1];
  const earliest = data[0];

  if (loading) return <div className="pd-loading">Building visibility report…</div>;
  if (!latest) return <DataStatus status={status === "ok" ? "never_synced" : status} />;

  const top3 = latest.top_3;
  const top10Only = Math.max(0, latest.top_10 - latest.top_3);
  const top100Only = Math.max(0, latest.top_100 - latest.top_10);
  const notRanking = latest.not_ranked;
  const almost = Math.max(0, latest.top_20 - latest.top_10);
  const page1 = latest.top_10;
  const page1Before = earliest ? earliest.top_10 : null;

  const pie = [
    { name: "Top 3", value: top3, color: PIE_COLORS.top3 },
    { name: "Top 10", value: top10Only, color: PIE_COLORS.top10 },
    { name: "Top 100", value: top100Only, color: PIE_COLORS.top100 },
    { name: "Not ranking", value: notRanking, color: PIE_COLORS.none },
  ].filter((p) => p.value > 0);

  const pieOrEmpty =
    pie.length > 0
      ? pie
      : [{ name: "No data", value: 1, color: "#E7EAF0" }];

  const chartData = data.map((s) => ({
    date: new Date(s.captured_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    "On page 1": s.top_10,
    "Almost page 1": Math.max(0, s.top_20 - s.top_10),
  }));

  const story =
    page1Before != null && page1 !== page1Before
      ? page1 > page1Before
        ? `You now have ${page1} keywords on Google’s first page, up from ${page1Before} at the start of this period.`
        : `You have ${page1} keywords on Google’s first page, down from ${page1Before} at the start of this period.`
      : `Right now ${page1} of your tracked keywords sit on Google’s first page, and ${almost} are close (positions 11–20).`;

  return (
    <div className="pd">
      <h3 className="pd-headline">Visibility report</h3>
      <p className="pd-explain">{story}</p>

      <div className="pd-grid">
        <div className="pd-panel">
          <div className="pd-panel-title">Current search result rankings</div>
          <div className="pd-pie-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieOrEmpty}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {pieOrEmpty.map((p) => (
                    <Cell key={p.name} fill={p.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [Number(v).toLocaleString(), "Keywords"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pd-pie-legend">
              {[
                { label: "Top 3", count: top3, color: PIE_COLORS.top3 },
                { label: "Top 10", count: top10Only, color: PIE_COLORS.top10 },
                { label: "Top 100", count: top100Only, color: PIE_COLORS.top100 },
                { label: "Not ranking", count: notRanking, color: PIE_COLORS.none },
              ].map((b) => (
                <div key={b.label} className="pd-leg">
                  <span className="pd-leg-dot" style={{ background: b.color }} />
                  <span className="pd-leg-label">{b.label}</span>
                  <span className="pd-leg-n">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pd-panel pd-almost">
          <div className="pd-panel-title">Almost page 1</div>
          <div className="pd-almost-n">{almost}</div>
          <p className="pd-almost-copy">
            Keywords sitting in positions 11–20. Ubersuggest doesn’t highlight this — we do, because one push can
            put them on Google’s first page. Fix them in AI Recommendations → Almost page 1.
          </p>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="pd-panel" style={{ marginTop: 14 }}>
          <div className="pd-chart-label">How page-1 visibility changed (last {days} days)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
              <XAxis {...t.xAxis} dataKey="date" tick={{ fill: "#9AA3B2", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#9AA3B2", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                {...t.tooltip}
                contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 8, fontSize: 11 }}
              />
              <Bar dataKey="On page 1" fill="#00B894" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Almost page 1" fill="#D97706" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
