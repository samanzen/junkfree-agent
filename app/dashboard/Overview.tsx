"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Snap = {
  organic_traffic: number | null; organic_keywords: number | null;
  backlinks: number | null; referring_domains: number | null;
  striking_distance: number | null; avg_position: number | null;
  ai_visibility: number | null; site_health: number | null;
  captured_at: string;
};
type Kw = { keyword: string; page: string; impressions: number; position: number; ctr: number };

export default function Overview({ brandId }: { brandId: string }) {
  const [cur, setCur] = useState<Snap | null>(null);
  const [prev, setPrev] = useState<Snap | null>(null);
  const [series, setSeries] = useState<Snap[]>([]);
  const [kws, setKws] = useState<Kw[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    setLoading(true);
    fetch(`/api/analytics?brand=${brandId}`).then((r) => r.json()).then((d) => {
      setCur(d.current); setPrev(d.previous); setSeries(d.series || []); setKws(d.keywords || []); setLoading(false);
    }).catch(() => setLoading(false));
  }, [brandId]);

  if (loading) return <p className="muted">Loading analytics…</p>;

  if (!cur) return (
    <div className="empty">No analytics yet. Run the agents once to capture your first KPI snapshot.</div>
  );

  const delta = (k: keyof Snap): number | null => {
    if (!prev || cur[k] == null || prev[k] == null) return null;
    return (cur[k] as number) - (prev[k] as number);
  };
  const chartData = series.map((s) => ({
    d: new Date(s.captured_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    traffic: s.organic_traffic ?? 0, keywords: s.organic_keywords ?? 0, pos: s.avg_position ?? 0,
  }));

  return (
    <div className="ov">
      {/* KPI cards */}
      <div className="kpis">
        <Kpi label="Organic traffic" value={cur.organic_traffic} d={delta("organic_traffic")} />
        <Kpi label="Organic keywords" value={cur.organic_keywords} d={delta("organic_keywords")} />
        <Kpi label="Backlinks" value={cur.backlinks} d={delta("backlinks")} />
        <Kpi label="Referring domains" value={cur.referring_domains} d={delta("referring_domains")} />
        <Kpi label="Striking distance" value={cur.striking_distance} d={delta("striking_distance")} hint="keywords in pos 5–20" />
        <Kpi label="Avg position" value={cur.avg_position} d={delta("avg_position")} invert hint="lower is better" />
        <Kpi label="AI visibility" value={cur.ai_visibility} suffix="%" d={delta("ai_visibility")} hint="cited in ChatGPT / Gemini" />
        <Kpi label="Site health" value={cur.site_health} suffix="%" d={delta("site_health")} />
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="panel">
          <div className="panelhead"><span className="fieldlabel">position tracking</span><span className="muted small">last {chartData.length} snapshots</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34E0C4" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#34E0C4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="d" tick={{ fill: "#7E8CA0", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#263041" }} />
              <YAxis tick={{ fill: "#7E8CA0", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#141B26", border: "1px solid #263041", borderRadius: 8, color: "#E6EBF2", fontSize: 12 }} />
              <Area type="monotone" dataKey="traffic" stroke="#34E0C4" strokeWidth={2} fill="url(#g)" name="Est. traffic" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top keywords table */}
      <div className="panel">
        <div className="panelhead"><span className="fieldlabel">top keywords — striking distance</span></div>
        {kws.length ? (
          <table className="kwt">
            <thead><tr><th>Keyword</th><th>Position</th><th>Impressions</th><th>CTR</th></tr></thead>
            <tbody>
              {kws.map((k, i) => (
                <tr key={i}>
                  <td className="kw">{k.keyword}</td>
                  <td><span className="pos">{k.position}</span></td>
                  <td>{k.impressions.toLocaleString()}</td>
                  <td>{(k.ctr * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted small">No ranking data yet — connect Search Console and run the agents.</p>}
      </div>
    </div>
  );
}

function Kpi({ label, value, d, suffix, hint, invert }: { label: string; value: number | null; d: number | null; suffix?: string; hint?: string; invert?: boolean }) {
  const up = d != null && d > 0;
  const good = invert ? !up : up;
  return (
    <div className="kpi">
      <div className="klabel">{label}</div>
      <div className="kval">{value == null ? "—" : value.toLocaleString()}{value != null && suffix ? suffix : ""}</div>
      <div className="krow">
        {d != null && d !== 0 && <span className={`kd ${good ? "good" : "bad"}`}>{up ? "▲" : "▼"} {Math.abs(d).toLocaleString()}</span>}
        {hint && <span className="khint">{hint}</span>}
      </div>
    </div>
  );
}
