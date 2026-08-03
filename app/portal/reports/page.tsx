"use client";
import { useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import { usePortalSummary, usePlatformData } from "../_data";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import StatTile from "../_components/StatTile";
import EmptyState from "../_components/EmptyState";
import ConnectCard from "../_components/ConnectCard";
import { Stagger } from "../_components/motion";
import { IconReports } from "../icons";

type Tab = "current" | "scheduled";

export default function ReportsPage() {
  const { brand } = usePortalAuth();
  const { summary, loading } = usePortalSummary(brand?.id);
  const { data: platform } = usePlatformData(brand?.id);
  const [tab, setTab] = useState<Tab>("current");

  if (!brand) return null;

  const m = summary?.metrics;
  const today = new Date();

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Reports"
        title="Performance reports"
        sub="A clean summary of your results you can save, print or send on."
        action={
          <button className="p-btn primary p-no-print" onClick={() => window.print()} disabled={!summary}>
            <IconReports size={15} /> Download PDF
          </button>
        }
      />

      <div className="p-no-print">
        <SubNav
          items={[{ key: "current", label: "Current report" }, { key: "scheduled", label: "Scheduled & white-label" }]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "current" ? (
        loading || !summary || !m ? (
          <div className="p-skel" style={{ height: 420 }} />
        ) : (
          <div className="p-report">
            <div className="p-report-head">
              <div>
                <h2 className="p-report-title">{brand.name}</h2>
                <div className="p-report-period">
                  SEO performance report · {today.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "var(--muted)" }}>
                {summary.brand?.service_area && <div>{summary.brand.service_area}</div>}
                <div>{brand.site_url.replace(/^https?:\/\//, "")}</div>
              </div>
            </div>

            <div className="p-report-section">
              <h3>Headline numbers</h3>
              <Stagger className="p-stat-grid">
                <StatTile label="Organic traffic" value={fmt(m.organic_traffic)} tone="accent" sub={delta(m.traffic_delta)} />
                <StatTile label="Ranking keywords" value={fmt(m.organic_keywords)} tone="green" sub={delta(m.keywords_delta)} />
                <StatTile label="Average position" value={m.avg_position != null ? m.avg_position.toFixed(1) : "—"} tone="amber" sub={delta(m.position_delta)} />
                <StatTile label="Backlinks" value={fmt(m.backlinks)} tone="blue" sub={delta(m.backlinks_delta)} />
                <StatTile label="Referring domains" value={fmt(m.referring_domains)} tone="blue" />
                <StatTile label="Site health" value={m.site_health != null ? `${m.site_health}%` : "—"} tone="pink" />
              </Stagger>
            </div>

            <div className="p-report-section">
              <h3>What we did this month</h3>
              <Stagger className="p-stat-grid">
                <StatTile label="Content published" value={summary.activity.published_this_month} tone="accent" />
                <StatTile label="Google posts drafted" value={summary.activity.gbp_posts_drafted} tone="green" />
                <StatTile label="Citations live" value={summary.activity.citations_live} tone="amber" />
                <StatTile label="Reviews handled" value={platform?.reviews.length ?? 0} tone="pink" />
              </Stagger>
            </div>

            {summary.activity.recent_content.length > 0 && (
              <div className="p-report-section">
                <h3>Content published</h3>
                <table className="p-table">
                  <thead><tr><th>Title</th><th>Target keyword</th><th>Date</th></tr></thead>
                  <tbody>
                    {summary.activity.recent_content.map((c, i) => (
                      <tr key={i}>
                        <td><b>{c.title}</b></td>
                        <td>{c.keyword || <span className="p-na">—</span>}</td>
                        <td>{new Date(c.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {summary.opportunities.length > 0 && (
              <div className="p-report-section">
                <h3>Biggest opportunities right now</h3>
                <table className="p-table">
                  <thead><tr><th>Keyword</th><th>Position</th><th>Monthly impressions</th></tr></thead>
                  <tbody>
                    {summary.opportunities.map((o, i) => (
                      <tr key={i}>
                        <td><b>{o.keyword}</b></td>
                        <td><span className="p-pos top20">{o.position}</span></td>
                        <td>{o.impressions.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {summary.insights.length > 0 && (
              <div className="p-report-section">
                <h3>What we learned</h3>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.8, color: "var(--text)" }}>
                  {summary.insights.map((ins, i) => <li key={i}>{ins}</li>)}
                </ul>
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, fontSize: 11.5, color: "var(--muted2)" }}>
              Generated by your autonomous SEO platform · {today.toLocaleString()}
            </div>
          </div>
        )
      ) : (
        <Stagger className="p-subgrid">
          <ConnectCard
            icon={<IconReports size={17} />}
            title="Scheduled email reports"
            desc="Have this report delivered automatically every week, month or quarter — to you, your business partner, or anyone else who should see it."
            note="Report emails aren't switched on for your account yet."
          />
          <ConnectCard
            title="White-label reports"
            desc="Put your own logo, colours and company details on every report, so it can be shared with clients as your own work."
          />
          <ConnectCard
            title="Period comparisons"
            desc="Compare any two date ranges side by side — this month vs last, this quarter vs the same quarter last year."
          />
        </Stagger>
      )}

      {tab === "current" && !loading && !summary && (
        <EmptyState icon="📄" title="No report data yet" sub="Your first report is generated once we've captured performance data for your site." />
      )}
    </div>
  );
}

function fmt(n: number | null | undefined) {
  return n == null ? "—" : n.toLocaleString();
}
function delta(d: number | null | undefined): string | undefined {
  if (d == null || d === 0) return undefined;
  return `${d > 0 ? "+" : ""}${d.toLocaleString(undefined, { maximumFractionDigits: 1 })} vs previous`;
}
