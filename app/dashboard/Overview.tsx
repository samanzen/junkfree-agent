"use client";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import CountUp from "./CountUp";

type Snap = {
  organic_traffic: number | null; organic_keywords: number | null;
  backlinks: number | null; referring_domains: number | null;
  striking_distance: number | null; avg_position: number | null;
  ai_visibility: number | null; site_health: number | null;
  captured_at: string;
};
type Kw = { keyword: string; page: string; impressions: number; position: number; ctr: number };
type LowCtr = { page: string; impressions: number; ctr: number };
type Agent = {
  total_published: number; pending_review: number; total_runs: number;
  successful_runs: number; content_by_type: Record<string, number>;
  weekly_activity: { week: string; count: number }[];
};

const ACCENT = "#6C5CE7";
const GREEN = "#00B894";
const AMBER = "#F5B461";
const CORAL = "#FF6B6B";

export default function Overview({ brandId }: { brandId: string }) {
  const [data, setData] = useState<{
    current: Snap | null; previous: Snap | null;
    series: Snap[]; keywords: Kw[]; lowCtrPages: LowCtr[]; agent: Agent;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<"traffic" | "keywords" | "position">("traffic");

  useEffect(() => {
    if (!brandId) return;
    setLoading(true);
    setData(null);
    fetch(`/api/analytics?brand=${brandId}`)
      .then((r) => r.json())
      .then((d) => {
        // If current is null but we know data exists, retry once after 2s
        if (!d.current) {
          setTimeout(() => {
            fetch(`/api/analytics?brand=${brandId}`)
              .then((r2) => r2.json())
              .then((d2) => { setData(d2); setLoading(false); })
              .catch(() => setLoading(false));
          }, 2000);
        } else {
          setData(d); setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [brandId]);

  if (loading) return <OvSkeleton />;
  if (!data?.current) return (
    <div className="ov-empty">
      <div className="ov-empty-icon">📊</div>
      <h3>No analytics data yet</h3>
      <p>Run the agents to capture your first KPI snapshot. Data appears here after the first successful run.</p>
    </div>
  );

  const { current: c, previous: p, series, keywords, lowCtrPages, agent } = data;

  const delta = (k: keyof Snap): number | null => {
    if (!p || c[k] == null || p[k] == null) return null;
    return (c[k] as number) - (p[k] as number);
  };

  const chartData = series.map((s) => ({
    d: new Date(s.captured_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    traffic: s.organic_traffic ?? 0,
    keywords: s.organic_keywords ?? 0,
    position: s.avg_position ?? 0,
    health: s.site_health ?? 0,
  }));

  const chartConfig = {
    traffic: { key: "traffic", name: "Est. traffic", color: ACCENT, gradient: "gTraffic" },
    keywords: { key: "keywords", name: "Ranking keywords", color: GREEN, gradient: "gKeywords" },
    position: { key: "position", name: "Avg. position", color: AMBER, gradient: "gPosition" },
  };
  const cc = chartConfig[activeChart];

  const typeLabels: Record<string, string> = {
    new_blog: "Blog posts", new_page: "Service pages",
    fix_meta: "Meta fixes", improve_content: "Content rewrites",
    geo_answers: "FAQ / GEO",
  };

  return (
    <div className="ov">
      {/* ── Row 1: KPI cards ── */}
      <div className="ov-kpis">
        <KpiCard label="Organic traffic" value={c.organic_traffic} d={delta("organic_traffic")}
          color={ACCENT} hint="Monthly estimated visitors" />
        <KpiCard label="Ranking keywords" value={c.organic_keywords} d={delta("organic_keywords")}
          color={GREEN} hint="Keywords appearing in Google" />
        <KpiCard label="Backlinks" value={c.backlinks} d={delta("backlinks")}
          color="#0984E3" hint="Total inbound links" />
        <KpiCard label="Referring domains" value={c.referring_domains} d={delta("referring_domains")}
          color="#E17055" hint="Unique sites linking to you" />
        <KpiCard label="Avg. position" value={c.avg_position} d={delta("avg_position")}
          color={AMBER} decimals={1} invert hint="Lower is better" />
        <KpiCard label="Striking distance" value={c.striking_distance} d={delta("striking_distance")}
          color="#E84393" hint="Keywords in pos 5–20" />
        <KpiCard label="AI visibility" value={c.ai_visibility} suffix="%"
          color="#A29BFE" hint="Cited in ChatGPT / Gemini" />
        <KpiCard label="Site health" value={c.site_health} suffix="%"
          color="#FDCB6E" hint="Technical SEO score" />
      </div>

      {/* ── Row 2: Main chart + Agent stats ── */}
      <div className="ov-row2">
        {/* Main trend chart */}
        <div className="ov-panel ov-chart-panel">
          <div className="ov-panel-head">
            <h3>Performance trend</h3>
            <div className="ov-chart-tabs">
              {(["traffic", "keywords", "position"] as const).map((t) => (
                <button key={t} className={`ov-ctab ${activeChart === t ? "on" : ""}`}
                  onClick={() => setActiveChart(t)}>
                  {chartConfig[t].name}
                </button>
              ))}
            </div>
          </div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id={cc.gradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cc.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={cc.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
                <XAxis dataKey="d" tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#EEF0F4" }} />
                <YAxis tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,.08)" }} />
                <Area type="monotone" dataKey={cc.key} stroke={cc.color} strokeWidth={2.5}
                  fill={`url(#${cc.gradient})`} name={cc.name} animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="ov-chart-empty">Run the agents a few times to see trend data here.</div>
          )}
        </div>

        {/* Agent activity */}
        <div className="ov-panel ov-agent-panel">
          <div className="ov-panel-head"><h3>Agent activity</h3></div>
          <div className="ov-agent-stats">
            <AgentStat n={agent.total_published} label="Published" color={GREEN} />
            <AgentStat n={agent.pending_review} label="Pending review" color={AMBER} />
            <AgentStat n={agent.successful_runs} label="Runs completed" color={ACCENT} />
          </div>
          <div className="ov-type-list">
            {Object.entries(agent.content_by_type).map(([type, count]) => (
              <div key={type} className="ov-type-row">
                <span className="ov-type-label">{typeLabels[type] || type}</span>
                <div className="ov-type-bar-wrap">
                  <div className="ov-type-bar"
                    style={{ width: `${Math.min(100, (count / Math.max(...Object.values(agent.content_by_type))) * 100)}%`, background: ACCENT }} />
                </div>
                <span className="ov-type-count">{count}</span>
              </div>
            ))}
          </div>
          {agent.weekly_activity.length > 1 && (
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={agent.weekly_activity} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="week" tick={{ fill: "#B2BAC8", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} name="Drafts" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 3: Keywords table + Low CTR pages ── */}
      <div className="ov-row2">
        {/* Striking distance keywords */}
        <div className="ov-panel">
          <div className="ov-panel-head">
            <h3>Striking distance keywords</h3>
            <span className="ov-badge">{keywords.length} opportunities</span>
          </div>
          <p className="ov-panel-sub">Ranking pos 5–20 — a small content push could reach page 1.</p>
          {keywords.length > 0 ? (
            <table className="ov-table">
              <thead>
                <tr><th>Keyword</th><th>Pos</th><th>Impr.</th><th>CTR</th></tr>
              </thead>
              <tbody>
                {keywords.slice(0, 10).map((k, i) => (
                  <tr key={i}>
                    <td className="ov-kw">{k.keyword}</td>
                    <td>
                      <span className="ov-pos" style={{
                        background: k.position <= 10 ? "rgba(0,184,148,.12)" : "rgba(108,92,231,.1)",
                        color: k.position <= 10 ? GREEN : ACCENT,
                      }}>{k.position}</span>
                    </td>
                    <td>{k.impressions.toLocaleString()}</td>
                    <td>{(k.ctr * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="ov-empty-msg">Connect Search Console to see keyword data.</p>
          )}
        </div>

        {/* Low CTR pages */}
        <div className="ov-panel">
          <div className="ov-panel-head">
            <h3>Low CTR pages</h3>
            <span className="ov-badge ov-badge-warn">{lowCtrPages.length} pages</span>
          </div>
          <p className="ov-panel-sub">High impressions, low clicks — weak title or meta description.</p>
          {lowCtrPages.length > 0 ? (
            <table className="ov-table">
              <thead>
                <tr><th>Page</th><th>Impr.</th><th>CTR</th></tr>
              </thead>
              <tbody>
                {lowCtrPages.slice(0, 8).map((p, i) => (
                  <tr key={i}>
                    <td className="ov-page-url" title={p.page}>
                      {p.page.replace(/^https?:\/\/[^/]+/, "").slice(0, 40) || "/"}
                    </td>
                    <td>{p.impressions.toLocaleString()}</td>
                    <td>
                      <span style={{ color: CORAL, fontWeight: 600 }}>
                        {(p.ctr * 100).toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="ov-empty-msg">No low-CTR pages detected — good sign.</p>
          )}
        </div>
      </div>

      {/* ── Row 4: Health + Position combo chart ── */}
      {chartData.length > 1 && (
        <div className="ov-panel">
          <div className="ov-panel-head">
            <h3>Site health vs. average position</h3>
            <span className="ov-panel-sub-inline">Health should rise as position falls</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
              <XAxis dataKey="d" tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#EEF0F4" }} />
              <YAxis yAxisId="left" tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={false} reversed />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 10, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="health" stroke={GREEN} strokeWidth={2} dot={false} name="Site health %" animationDuration={900} />
              <Line yAxisId="right" type="monotone" dataKey="position" stroke={AMBER} strokeWidth={2} dot={false} name="Avg. position" animationDuration={900} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function KpiCard({ label, value, d, color, hint, suffix = "", decimals = 0, invert = false }: {
  label: string; value: number | null; d?: number | null; color: string;
  hint?: string; suffix?: string; decimals?: number; invert?: boolean;
}) {
  const up = d != null && d > 0;
  const good = invert ? !up : up;
  return (
    <div className="ov-kpi">
      <div className="ov-kpi-accent" style={{ background: color }} />
      <div className="ov-kpi-label">{label}</div>
      <div className="ov-kpi-val" style={{ color }}>
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </div>
      <div className="ov-kpi-foot">
        {d != null && d !== 0 && (
          <span className={`ov-delta ${good ? "g" : "b"}`}>
            {up ? "▲" : "▼"} {Math.abs(d).toLocaleString()}
          </span>
        )}
        {hint && <span className="ov-hint">{hint}</span>}
      </div>
    </div>
  );
}

function AgentStat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="ov-astat">
      <div className="ov-astat-n" style={{ color }}>{n}</div>
      <div className="ov-astat-l">{label}</div>
    </div>
  );
}

function OvSkeleton() {
  return (
    <div>
      <div className="ov-kpis">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="ov-skel" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      <div className="ov-skel ov-skel-lg" />
    </div>
  );
}
