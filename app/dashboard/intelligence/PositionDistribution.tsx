"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
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

  const page1 = latest.top_10;
  const almost = Math.max(0, latest.top_20 - latest.top_10);
  const deeper = Math.max(0, latest.top_100 - latest.top_20);
  const page1Before = earliest ? earliest.top_10 : null;

  const breakdown = [
    {
      label: "Page 1 (positions 1–10)",
      hint: "Best place to be — people actually click these.",
      count: page1,
      color: "#00B894",
    },
    {
      label: "Almost page 1 (11–20)",
      hint: "Close wins — a small push can get them onto page 1.",
      count: almost,
      color: "#D97706",
    },
    {
      label: "Further back (21–100)",
      hint: "Harder to get clicks, but still tracked.",
      count: deeper,
      color: "#6366F1",
    },
    {
      label: "Not ranking yet",
      hint: "Searches we track where Google doesn’t show you yet.",
      count: latest.not_ranked,
      color: "#CBD5E1",
    },
  ];

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

      <div className="pd-breakdown">
        {breakdown.map((b) => {
          const total = breakdown.reduce((s, x) => s + x.count, 0);
          const pct = total ? Math.round((b.count / total) * 100) : 0;
          return (
            <div key={b.label}>
              <div className="pd-bar-row">
                <span className="pd-bar-label">{b.label}</span>
                <div className="pd-bar-track">
                  <div className="pd-bar-fill" style={{ width: `${pct}%`, background: b.color }} />
                </div>
                <span className="pd-bar-count">
                  {b.count} · {pct}%
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#8A93A6", paddingLeft: 2 }}>{b.hint}</p>
            </div>
          );
        })}
      </div>

      {chartData.length > 1 && (
        <div>
          <div className="pd-chart-label">How page-1 visibility changed (last {days} days)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
              <XAxis {...t.xAxis} dataKey="date" tick={{ fill: "#9AA3B2", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#9AA3B2", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...t.tooltip} contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="On page 1" fill="#00B894" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Almost page 1" fill="#D97706" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
