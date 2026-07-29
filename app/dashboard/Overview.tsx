"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import CountUp from "./CountUp";

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

  if (loading) return <p className="lmuted">Loading analytics…</p>;
  if (!cur) return <div className="lempty">No analytics yet. Run the agents once to capture your first KPI snapshot.</div>;

  const delta = (k: keyof Snap): number | null => {
    if (!prev || cur[k] == null || prev[k] == null) return null;
    return (cur[k] as number) - (prev[k] as number);
  };
  const chartData = series.map((s) => ({
    d: new Date(s.captured_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    traffic: s.organic_traffic ?? 0,
  }));

  const cards: { label: string; value: number | null; d: number | null; suffix?: string; hint?: string; invert?: boolean; color: string }[] = [
    { label: "Organic traffic", value: cur.organic_traffic, d: delta("organic_traffic"), color: "#6C5CE7" },
    { label: "Organic keywords", value: cur.organic_keywords, d: delta("organic_keywords"), color: "#0984E3" },
    { label: "Backlinks", value: cur.backlinks, d: delta("backlinks"), color: "#00B894" },
    { label: "Referring domains", value: cur.referring_domains, d: delta("referring_domains"), color: "#E17055" },
    { label: "Striking distance", value: cur.striking_distance, d: delta("striking_distance"), hint: "keywords in pos 5–20", color: "#E84393" },
    { label: "Avg position", value: cur.avg_position, d: delta("avg_position"), invert: true, hint: "lower is better", color: "#00CEC9" },
    { label: "AI visibility", value: cur.ai_visibility, suffix: "%", d: delta("ai_visibility"), hint: "cited in ChatGPT / Gemini", color: "#A29BFE" },
    { label: "Site health", value: cur.site_health, suffix: "%", d: delta("site_health"), color: "#FDCB6E" },
  ];

  return (
    <div className="lov">
      <div className="lkpis">
        {cards.map((c, i) => {
          const up = c.d != null && c.d > 0;
          const good = c.invert ? !up : up;
          return (
            <div className="lkpi" key={c.label} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="ltop"><span className="lbar" style={{ background: c.color }} /><span className="llabel">{c.label}</span></div>
              <div className="lval"><CountUp value={c.value} decimals={c.label === "Avg position" ? 1 : 0} suffix={c.suffix || ""} /></div>
              <div className="lrow">
                {c.d != null && c.d !== 0 && <span className={`ld ${good ? "good" : "bad"}`}>{up ? "↑" : "↓"} {Math.abs(c.d).toLocaleString()}</span>}
                {c.hint && <span className="lhint">{c.hint}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {chartData.length > 1 && (
        <div className="lpanel">
          <div className="lphead"><h3>Traffic trend</h3><span className="lmuted small">last {chartData.length} snapshots</span></div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6C5CE7" stopOpacity={0.25} /><stop offset="100%" stopColor="#6C5CE7" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
              <XAxis dataKey="d" tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#EEF0F4" }} />
              <YAxis tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,.08)" }} />
              <Area type="monotone" dataKey="traffic" stroke="#6C5CE7" strokeWidth={2.5} fill="url(#lg)" name="Est. traffic" animationDuration={1100} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="lpanel">
        <div className="lphead"><h3>Top keywords — striking distance</h3></div>
        {kws.length ? (
          <table className="lkwt">
            <thead><tr><th>Keyword</th><th>Position</th><th>Impressions</th><th>CTR</th></tr></thead>
            <tbody>{kws.map((k, i) => (
              <tr key={i} style={{ animationDelay: `${i * 40}ms` }}>
                <td className="lkw">{k.keyword}</td>
                <td><span className="lpos">{k.position}</span></td>
                <td>{k.impressions.toLocaleString()}</td>
                <td>{(k.ctr * 100).toFixed(1)}%</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="lmuted small">No ranking data yet — connect Search Console and run the agents.</p>}
      </div>
    </div>
  );
}
