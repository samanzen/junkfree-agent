"use client";
import { useEffect, useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import { authedFetch } from "@/lib/authedFetch";
import { usePortalSummary } from "../_data";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import ScoreRing from "../_components/ScoreRing";
import StatTile from "../_components/StatTile";
import EmptyState from "../_components/EmptyState";
import ConnectCard from "../_components/ConnectCard";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger } from "../_components/motion";
import { IconWebsite, IconArrowUp, IconArrowDown, IconExternal } from "../icons";
import ResponsiveTable from "@/app/_components/ResponsiveTable";

type PageRow = {
  page: string; clicks: number; impressions: number; avg_ctr: number;
  best_position: number | null; keyword_count: number; top_keyword: string | null;
  click_delta: number | null; status: "growing" | "declining" | "stable" | "new" | string;
};

type Tab = "pages" | "technical" | "vitals" | "structure";

const TABS: { key: Tab; label: string }[] = [
  { key: "pages", label: "Pages" },
  { key: "technical", label: "Technical SEO" },
  { key: "vitals", label: "Core Web Vitals" },
  { key: "structure", label: "Structure & Indexing" },
];

export default function WebsitePage() {
  const { brand } = usePortalAuth();
  const { summary } = usePortalSummary(brand?.id);
  const [tab, setTab] = useState<Tab>("pages");
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brand?.id) return;
    let cancelled = false;
    setLoading(true);
    authedFetch(`/api/intelligence/content?brand=${brand.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setPages(d.pages || []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brand?.id]);

  if (!brand) return null;

  const siteHealth = summary?.metrics.site_health ?? null;
  const totalClicks = pages.reduce((s, p) => s + p.clicks, 0);
  const totalImpressions = pages.reduce((s, p) => s + p.impressions, 0);
  const growing = pages.filter((p) => p.status === "growing").length;
  const declining = pages.filter((p) => p.status === "declining").length;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Website"
        title="Your website's health"
        sub="Which pages bring you traffic, and what's holding the rest back."
        action={
          <a href={brand.site_url} target="_blank" rel="noreferrer" className="p-btn ghost">
            Visit site <IconExternal size={13} />
          </a>
        }
      />

      <SubNav items={TABS} value={tab} onChange={setTab} />

      {tab === "pages" && (
        <div className="p-stack">
          <Panel>
            <PanelHead title="Page performance" sub="Every page of yours that Google sends traffic to, over the last 7 days." />
            <Stagger className="p-stat-grid">
              <StatTile label="Pages ranking" value={pages.length || "—"} tone={pages.length ? "accent" : "muted"} />
              <StatTile label="Total clicks" value={totalClicks ? totalClicks.toLocaleString() : "—"} tone="green" />
              <StatTile label="Total impressions" value={totalImpressions ? totalImpressions.toLocaleString() : "—"} tone="blue" />
              <StatTile label="Growing" value={growing || "—"} tone="green" />
              <StatTile label="Declining" value={declining || "—"} tone={declining ? "red" : "muted"} />
            </Stagger>
          </Panel>

          <Panel>
            <PanelHead title="All pages" badge={pages.length || undefined} />
            {loading ? (
              <div className="p-stack">
                {[...Array(5)].map((_, i) => <div key={i} className="p-skel" style={{ height: 44 }} />)}
              </div>
            ) : pages.length === 0 ? (
              <EmptyState
                icon="🌐"
                title="No page data yet"
                sub="Page performance is built from your Search Console rankings. It appears after your first daily sync."
              />
            ) : (
              <ResponsiveTable>
                <table className="p-table">
                  <thead>
                    <tr><th>Page</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Best pos.</th><th>Keywords</th><th>Trend</th></tr>
                  </thead>
                  <tbody>
                    {pages.slice(0, 50).map((p, i) => (
                      <tr key={i}>
                        <td>
                          <a href={p.page} target="_blank" rel="noreferrer"
                            className="p-kwcell" style={{ color: "var(--accent)", textDecoration: "none", display: "block" }}
                            title={p.page}>
                            {p.page.replace(/^https?:\/\/[^/]+/, "") || "/"}
                          </a>
                          {p.top_keyword && (
                            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{p.top_keyword}</div>
                          )}
                        </td>
                        <td><b>{p.clicks.toLocaleString()}</b></td>
                        <td>{p.impressions.toLocaleString()}</td>
                        <td>{(p.avg_ctr * 100).toFixed(1)}%</td>
                        <td>{p.best_position != null ? <span className={`p-pos ${p.best_position <= 3 ? "top3" : p.best_position <= 10 ? "top10" : p.best_position <= 20 ? "top20" : ""}`}>{p.best_position}</span> : <span className="p-na">—</span>}</td>
                        <td>{p.keyword_count}</td>
                        <td><TrendChip status={p.status} delta={p.click_delta} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTable>
            )}
          </Panel>
        </div>
      )}

      {tab === "technical" && (
        <div className="p-stack">
          <Panel>
            <PanelHead title="Site health score" sub="From your most recent automated site audit." />
            <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <ScoreRing value={siteHealth} size={104} strokeWidth={10} />
              <div style={{ flex: 1, minWidth: 240 }}>
                <p className="p-panel-sub" style={{ margin: 0 }}>
                  {siteHealth == null
                    ? "Your first technical audit hasn't completed yet. Once it runs, this score reflects how many pages passed our on-page and technical checks."
                    : siteHealth >= 80
                    ? "Your site is in good technical shape. We'll keep auditing it daily and flag anything that regresses."
                    : "We found technical issues worth fixing. Your agents queue improvements automatically as they're detected."}
                </p>
              </div>
            </div>
          </Panel>

          <Stagger className="p-subgrid">
            <ConnectCard
              title="Issue breakdown"
              desc="A page-by-page list of every technical issue found — missing titles, thin content, duplicate meta descriptions, heading structure problems — each with a one-click fix."
              note="Surfaces here as the audit history builds up."
              unlocks={["Every issue listed page by page", "One-click fixes queued for you", "Prioritised by real ranking impact"]}
            />
            <ConnectCard
              title="Broken links"
              desc="Continuously scans your site for links that return 404s or redirect chains, both internally and to external sites."
              unlocks={["Continuous 404 and redirect-chain scanning", "Internal and outbound links both covered"]}
            />
            <ConnectCard
              title="Indexing status"
              desc="Which of your pages Google has actually indexed, which are excluded, and why — pulled directly from Search Console's index coverage."
              unlocks={["See exactly which pages Google indexed", "Understand why anything was excluded"]}
            />
          </Stagger>
        </div>
      )}

      {tab === "vitals" && (
        <Stagger className="p-subgrid">
          <ConnectCard
            icon={<IconWebsite size={17} />}
            title="Speed that Google rewards"
            desc="Core Web Vitals are a confirmed ranking factor. We track loading, responsiveness and visual stability on mobile and desktop, over time."
            unlocks={["Mobile and desktop scores tracked over time", "Measured against Google's pass thresholds", "Alerts when a release slows you down"]}
            note="Requires PageSpeed Insights to be connected."
          />
          <ConnectCard
            title="Page speed by template"
            desc="Identifies which page templates are slowest so fixes apply across many pages at once rather than one at a time."
            unlocks={["Find the slowest templates first", "Fix once, improve many pages at once"]}
          />
          <ConnectCard
            title="Mobile usability"
            desc="Flags tap targets that are too small, text that's too narrow to read, and content wider than the screen."
            unlocks={["Tap targets, font sizes and viewport issues", "Flagged before they cost you rankings"]}
          />
        </Stagger>
      )}

      {tab === "structure" && (
        <Stagger className="p-subgrid">
          <ConnectCard
            title="Internal linking opportunities"
            desc="Finds pages that should link to each other based on topic overlap — one of the highest-leverage, lowest-effort SEO wins available."
            note="Planned: uses your existing content and keyword map."
            unlocks={["Pages that should link to each other", "One of the fastest wins in SEO"]}
          />
          <ConnectCard
            title="Schema markup"
            desc="Checks your LocalBusiness, Service, FAQ and Review structured data, and generates whatever's missing so you're eligible for rich results."
            unlocks={["LocalBusiness, Service, FAQ and Review coverage", "Become eligible for rich results"]}
          />
          <ConnectCard
            title="Sitemap & robots"
            desc="Validates that your sitemap is present, current, and not blocking anything you want indexed."
            unlocks={["Validates your sitemap stays current", "Catches anything accidentally blocked"]}
          />
        </Stagger>
      )}
    </div>
  );
}

function TrendChip({ status, delta }: { status: string; delta: number | null }) {
  if (status === "growing") {
    return <span className="p-move-delta up"><IconArrowUp size={11} />{delta != null ? Math.abs(delta) : ""}</span>;
  }
  if (status === "declining") {
    return <span className="p-move-delta down"><IconArrowDown size={11} />{delta != null ? Math.abs(delta) : ""}</span>;
  }
  if (status === "new") return <span className="p-move-delta up">new</span>;
  return <span className="p-move-delta flat">stable</span>;
}
