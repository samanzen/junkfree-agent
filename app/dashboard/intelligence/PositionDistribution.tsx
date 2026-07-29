"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Snap = { captured_date: string; top_3: number; top_10: number; top_20: number; top_50: number; top_100: number; not_ranked: number; total_clicks: number };

export default function PositionDistribution({ brandId }: { brandId: string }) {
  const [data, setData] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    fetch(`/api/intelligence/distribution?brand=${brandId}&days=30`)
      .then((r) => r.json())
      .then((d) => { setData(d.distribution || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brandId]);

  const latest = data[data.length - 1];

  if (loading) return <div className="pd-loading">Loading distribution…</div>;
  if (!latest) return <div className="pd-empty">No distribution data yet. Run the agents to sync rankings.</div>;

  // Build breakdown from latest snapshot
  const breakdown = [
    { label: "Top 3",    count: latest.top_3,                                            color: "#00B894" },
    { label: "4–10",     count: Math.max(0, latest.top_10 - latest.top_3),               color: "#6C5CE7" },
    { label: "11–20",    count: Math.max(0, latest.top_20 - latest.top_10),              color: "#F5B461" },
    { label: "21–50",    count: Math.max(0, latest.top_50 - latest.top_20),              color: "#E17055" },
    { label: "51–100",   count: Math.max(0, latest.top_100 - latest.top_50),             color: "#B2BAC8" },
    { label: "Not ranked",count: latest.not_ranked,                                       color: "#E8ECF0" },
  ];

  // Trend data for the chart
  const chartData = data.slice(-14).map((s) => ({
    date: new Date(s.captured_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    "Top 3": s.top_3,
    "Top 10": s.top_10,
    "Top 20": s.top_20,
    "Top 100": s.top_100,
  }));

  return (
    <div className="pd">
      {/* Breakdown bars */}
      <div className="pd-breakdown">
        {breakdown.map((b) => {
          const total = breakdown.reduce((s, x) => s + x.count, 0);
          const pct = total ? Math.round((b.count / total) * 100) : 0;
          return (
            <div key={b.label} className="pd-bar-row">
              <span className="pd-bar-label">{b.label}</span>
              <div className="pd-bar-track">
                <div className="pd-bar-fill" style={{ width: `${pct}%`, background: b.color }} />
              </div>
              <span className="pd-bar-count" style={{ color: b.color }}>{b.count}</span>
            </div>
          );
        })}
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div style={{ marginTop: 20 }}>
          <div className="pd-chart-label">Position distribution trend (last {chartData.length} days)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#9AA3B2", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#9AA3B2", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="Top 3" fill="#00B894" radius={[3,3,0,0]} />
              <Bar dataKey="Top 10" fill="#6C5CE7" radius={[3,3,0,0]} />
              <Bar dataKey="Top 20" fill="#F5B461" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
