"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import CountUp from "@/app/dashboard/CountUp";

// ─── Types ───────────────────────────────────────────────────────────────────
type Metrics = {
  organic_traffic: number | null; organic_keywords: number | null;
  backlinks: number | null; referring_domains: number | null;
  striking_distance: number | null; avg_position: number | null;
  ai_visibility: number | null; site_health: number | null;
  traffic_delta: number | null; keywords_delta: number | null;
  backlinks_delta: number | null; position_delta: number | null;
};
type Summary = {
  brand: { name: string; site_url: string; service_area: string };
  metrics: Metrics;
  chart: { date: string; traffic: number; keywords: number }[];
  activity: {
    published_this_month: number;
    recent_content: { title: string; keyword: string | null; published_at: string }[];
    gbp_posts_drafted: number;
    citations_found: number;
    citations_live: number;
  };
  opportunities: { keyword: string; position: number; impressions: number }[];
  insights: string[];
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function Portal() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (!token) { router.push("/login"); return; }

      const me = await (await fetch("/api/me", {
        headers: { authorization: `Bearer ${token}` },
      })).json();

      if (me.role === "admin") setIsAdmin(true);

      // Admins without a specific brand see the first brand
      const bid = me.brand_id;
      if (!bid && me.role !== "admin") {
        setError("No brand linked to your account. Please contact support.");
        setLoading(false);
        return;
      }

      // If admin, get the first active brand
      let resolvedBrandId = bid;
      if (!resolvedBrandId) {
        const brands = await (await fetch("/api/platform")).json();
        resolvedBrandId = brands.brands?.[0]?.id ?? null;
      }
      if (!resolvedBrandId) {
        setError("No active brands found.");
        setLoading(false);
        return;
      }

      setBrandId(resolvedBrandId);
      const data2 = await (await fetch(
        `/api/portal/summary?brand=${resolvedBrandId}`
      )).json();
      setSummary(data2);
      setLoading(false);
    })();
  }, [router]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
  }

  if (loading) return <Shell onSignOut={signOut} isAdmin={isAdmin}><Skeleton /></Shell>;
  if (error) return <Shell onSignOut={signOut} isAdmin={isAdmin}><ErrMsg msg={error} /></Shell>;
  if (!summary) return null;

  const m = summary.metrics;

  return (
    <Shell onSignOut={signOut} isAdmin={isAdmin} brandName={summary.brand.name}>
      <style>{CSS}</style>

      {/* Header */}
      <div className="p-hero">
        <div>
          <div className="p-eyebrow">SEO Performance Dashboard</div>
          <h1 className="p-h1">{summary.brand.name}</h1>
          <p className="p-sub">{summary.brand.service_area}</p>
        </div>
        <a href={summary.brand.site_url} target="_blank" className="p-site-link" rel="noreferrer">
          View website ↗
        </a>
      </div>

      {/* KPI Grid */}
      <div className="p-kpis">
        <KpiCard label="Organic Traffic" value={m.organic_traffic} delta={m.traffic_delta} color="#6C5CE7" icon="📈" hint="Monthly visitors from Google" />
        <KpiCard label="Ranking Keywords" value={m.organic_keywords} delta={m.keywords_delta} color="#0984E3" icon="🔑" hint="Keywords you appear for" />
        <KpiCard label="Backlinks" value={m.backlinks} delta={m.backlinks_delta} color="#00B894" icon="🔗" hint="Sites linking to you" />
        <KpiCard label="Avg. Position" value={m.avg_position} delta={m.position_delta} color="#E17055" icon="📍" decimals={1} invert hint="Lower is better" />
        <KpiCard label="Striking Distance" value={m.striking_distance} color="#E84393" icon="⚡" hint="Keywords almost on page 1 (pos 5–20)" />
        <KpiCard label="AI Visibility" value={m.ai_visibility} color="#A29BFE" icon="🤖" suffix="%" hint="Cited by ChatGPT / Gemini" />
        <KpiCard label="Site Health" value={m.site_health} color="#FDCB6E" icon="❤️" suffix="%" hint="Technical SEO score" />
        <KpiCard label="Referring Domains" value={m.referring_domains} color="#74B9FF" icon="🌐" hint="Unique sites linking to you" />
      </div>

      {/* Traffic Chart */}
      {summary.chart.length > 1 && (
        <div className="p-panel">
          <h2 className="p-panel-title">Traffic Trend</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={summary.chart} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6C5CE7" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6C5CE7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#EEF0F4" }} />
              <YAxis tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,.08)" }} />
              <Area type="monotone" dataKey="traffic" stroke="#6C5CE7" strokeWidth={2.5} fill="url(#tg)" name="Est. traffic" animationDuration={1100} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two-column: Activity + Opportunities */}
      <div className="p-two-col">
        {/* Activity */}
        <div className="p-panel">
          <h2 className="p-panel-title">This Month&apos;s Activity</h2>
          <div className="p-stats-row">
            <Stat n={summary.activity.published_this_month} label="Articles published" color="#6C5CE7" />
            <Stat n={summary.activity.gbp_posts_drafted} label="Google posts drafted" color="#00B894" />
            <Stat n={summary.activity.citations_live} label="Citations live" color="#E17055" />
          </div>
          {summary.activity.recent_content.length > 0 && (
            <div className="p-content-list">
              <div className="p-list-label">Recently published</div>
              {summary.activity.recent_content.map((c, i) => (
                <div key={i} className="p-content-item">
                  <span className="p-content-dot" />
                  <div>
                    <div className="p-content-title">{c.title}</div>
                    {c.keyword && <div className="p-content-kw">{c.keyword}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opportunities */}
        <div className="p-panel">
          <h2 className="p-panel-title">Quick Win Opportunities</h2>
          <p className="p-panel-sub">Keywords almost on page 1 — a small push moves these to the top.</p>
          {summary.opportunities.length > 0 ? (
            <table className="p-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Position</th>
                  <th>Impressions</th>
                </tr>
              </thead>
              <tbody>
                {summary.opportunities.map((k, i) => (
                  <tr key={i}>
                    <td className="p-kw-cell">{k.keyword}</td>
                    <td><span className="p-pos-badge">{k.position}</span></td>
                    <td>{k.impressions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-empty">Connect Search Console to see keyword opportunities.</p>
          )}
        </div>
      </div>

      {/* Insights */}
      {summary.insights.length > 0 && (
        <div className="p-panel">
          <h2 className="p-panel-title">What We Learned This Week</h2>
          <div className="p-insights">
            {summary.insights.map((ins, i) => (
              <div key={i} className="p-insight">
                <span className="p-insight-icon">💡</span>
                <p>{ins}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-footer">
        <span>Powered by autonomous SEO agents</span>
        <span>·</span>
        <span>Updates daily</span>
        {isAdmin && (
          <>
            <span>·</span>
            <a href="/dashboard" className="p-footer-link">Admin dashboard →</a>
          </>
        )}
      </div>
    </Shell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Shell({ children, onSignOut, isAdmin, brandName }: {
  children: React.ReactNode;
  onSignOut: () => void;
  isAdmin: boolean;
  brandName?: string;
}) {
  return (
    <div className="p-root">
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <nav className="p-nav">
        <div className="p-nav-brand">
          <span className="p-nav-dot" />
          <span className="p-nav-name">{brandName || "SEO Platform"}</span>
        </div>
        <div className="p-nav-right">
          {isAdmin && <a href="/dashboard" className="p-nav-link">Admin</a>}
          <button onClick={onSignOut} className="p-nav-signout">Sign out</button>
        </div>
      </nav>
      <main className="p-main">{children}</main>
    </div>
  );
}

function KpiCard({ label, value, delta, color, icon, suffix = "", decimals = 0, invert = false, hint }: {
  label: string; value: number | null; delta?: number | null;
  color: string; icon: string; suffix?: string; decimals?: number;
  invert?: boolean; hint?: string;
}) {
  const up = delta != null && delta > 0;
  const good = invert ? !up : up;
  return (
    <div className="p-kpi">
      <div className="p-kpi-top">
        <span className="p-kpi-icon">{icon}</span>
        <span className="p-kpi-label">{label}</span>
      </div>
      <div className="p-kpi-val" style={{ color }}>
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </div>
      <div className="p-kpi-bottom">
        {delta != null && delta !== 0 && (
          <span className={`p-kpi-delta ${good ? "good" : "bad"}`}>
            {up ? "▲" : "▼"} {Math.abs(delta).toLocaleString()}
          </span>
        )}
        {hint && <span className="p-kpi-hint">{hint}</span>}
      </div>
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="p-stat">
      <div className="p-stat-n" style={{ color }}>{n}</div>
      <div className="p-stat-label">{label}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="p-skeleton">
      {[...Array(8)].map((_, i) => <div key={i} className="p-skel-card" style={{ animationDelay: `${i * 60}ms` }} />)}
    </div>
  );
}

function ErrMsg({ msg }: { msg: string }) {
  return <div className="p-err">{msg}</div>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
.p-root { min-height:100vh; background:#F6F8FB; font-family:'Space Grotesk',-apple-system,Segoe UI,sans-serif; color:#1A2030; -webkit-font-smoothing:antialiased; }
.p-nav { display:flex; align-items:center; justify-content:space-between; padding:0 28px; height:60px; background:#fff; border-bottom:1px solid #E7EAF0; position:sticky; top:0; z-index:100; box-shadow:0 1px 4px rgba(16,24,40,.04); }
.p-nav-brand { display:flex; align-items:center; gap:10px; }
.p-nav-dot { width:10px; height:10px; border-radius:50%; background:linear-gradient(135deg,#6C5CE7,#00B894); }
.p-nav-name { font-weight:700; font-size:15px; color:#12172A; }
.p-nav-right { display:flex; align-items:center; gap:16px; }
.p-nav-link { font-size:13px; color:#6C5CE7; font-weight:600; text-decoration:none; }
.p-nav-signout { background:transparent; border:1px solid #E7EAF0; color:#8A93A6; padding:7px 14px; border-radius:8px; font-size:13px; cursor:pointer; font-family:inherit; }
.p-nav-signout:hover { color:#1A2030; border-color:#9AA3B2; }
.p-main { max-width:1040px; margin:0 auto; padding:32px 22px 80px; }
.p-hero { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; }
.p-eyebrow { font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:#8A93A6; margin-bottom:4px; }
.p-h1 { font-size:30px; font-weight:700; letter-spacing:-.02em; margin:0 0 4px; }
.p-sub { color:#8A93A6; font-size:14px; margin:0; }
.p-site-link { font-size:13px; font-weight:600; color:#6C5CE7; text-decoration:none; border:1px solid rgba(108,92,231,.3); padding:9px 16px; border-radius:9px; white-space:nowrap; }
.p-site-link:hover { background:rgba(108,92,231,.06); }
.p-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px; }
.p-kpi { background:#fff; border:1px solid #E7EAF0; border-radius:16px; padding:18px; box-shadow:0 1px 3px rgba(16,24,40,.04); animation:prise .45s ease both; }
@keyframes prise { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
.p-kpi-top { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.p-kpi-icon { font-size:18px; line-height:1; }
.p-kpi-label { font-size:12px; font-weight:600; color:#8A93A6; }
.p-kpi-val { font-size:30px; font-weight:700; letter-spacing:-.02em; line-height:1.1; }
.p-kpi-bottom { display:flex; align-items:center; gap:8px; margin-top:8px; min-height:18px; flex-wrap:wrap; }
.p-kpi-delta { font-size:12px; font-weight:600; padding:2px 8px; border-radius:20px; }
.p-kpi-delta.good { color:#00B894; background:rgba(0,184,148,.1); }
.p-kpi-delta.bad { color:#E14B4B; background:rgba(225,75,75,.1); }
.p-kpi-hint { font-size:11px; color:#B2BAC8; }
.p-panel { background:#fff; border:1px solid #E7EAF0; border-radius:18px; padding:22px; margin-bottom:20px; box-shadow:0 1px 3px rgba(16,24,40,.04); animation:prise .45s ease both; }
.p-panel-title { font-size:16px; font-weight:700; margin:0 0 14px; color:#12172A; }
.p-panel-sub { font-size:13px; color:#8A93A6; margin:-8px 0 14px; }
.p-two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.p-stats-row { display:flex; gap:20px; margin-bottom:20px; }
.p-stat { text-align:center; flex:1; background:#F6F8FB; border-radius:12px; padding:14px 8px; }
.p-stat-n { font-size:28px; font-weight:700; letter-spacing:-.02em; }
.p-stat-label { font-size:12px; color:#8A93A6; margin-top:3px; }
.p-content-list { display:flex; flex-direction:column; gap:10px; }
.p-list-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:#B2BAC8; margin-bottom:4px; }
.p-content-item { display:flex; align-items:flex-start; gap:10px; }
.p-content-dot { width:7px; height:7px; border-radius:50%; background:#6C5CE7; margin-top:5px; flex-shrink:0; }
.p-content-title { font-size:13.5px; font-weight:500; line-height:1.4; }
.p-content-kw { font-size:11.5px; color:#8A93A6; margin-top:1px; }
.p-table { width:100%; border-collapse:collapse; }
.p-table th { text-align:left; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#8A93A6; padding:8px 10px; border-bottom:1px solid #E7EAF0; }
.p-table td { padding:11px 10px; font-size:13px; border-bottom:1px solid #E7EAF0; }
.p-table tr:last-child td { border-bottom:0; }
.p-kw-cell { font-weight:500; color:#1A2030; }
.p-pos-badge { background:rgba(108,92,231,.1); color:#6C5CE7; font-size:12px; font-weight:700; padding:3px 10px; border-radius:20px; }
.p-insights { display:flex; flex-direction:column; gap:12px; }
.p-insight { display:flex; align-items:flex-start; gap:12px; background:#F6F8FB; border-radius:12px; padding:14px; }
.p-insight-icon { font-size:18px; flex-shrink:0; margin-top:1px; }
.p-insight p { margin:0; font-size:13.5px; line-height:1.55; color:#3A4256; }
.p-empty { font-size:13px; color:#B2BAC8; }
.p-footer { display:flex; align-items:center; gap:10px; font-size:12px; color:#B2BAC8; padding-top:20px; }
.p-footer-link { color:#6C5CE7; text-decoration:none; font-weight:600; }
.p-skeleton { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.p-skel-card { height:110px; background:linear-gradient(90deg,#F0F2F5,#E7EAF0,#F0F2F5); background-size:200%; border-radius:16px; animation:prise .45s ease both, shimmer 1.4s infinite; }
@keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }
.p-err { padding:40px; text-align:center; color:#E14B4B; font-size:14px; }
@media(max-width:860px){ .p-kpis{grid-template-columns:repeat(2,1fr)} .p-two-col{grid-template-columns:1fr} }
@media(max-width:540px){ .p-kpis{grid-template-columns:repeat(2,1fr)} .p-hero{flex-direction:column;gap:16px} .p-site-link{width:100%;text-align:center} .p-stats-row{flex-direction:column;gap:10px} }
`;
