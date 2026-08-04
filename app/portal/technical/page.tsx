"use client";
import { useEffect, useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import { authedFetch } from "@/lib/authedFetch";
import { usePlatformData, usePortalSummary } from "../_data";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import ScoreRing from "../_components/ScoreRing";
import StatTile from "../_components/StatTile";
import EmptyState from "../_components/EmptyState";
import ConnectCard from "../_components/ConnectCard";
import TrendChart from "../_components/TrendChart";
import ExecutionPanel from "../_components/ExecutionPanel";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger } from "../_components/motion";
import {
  IconWebsite, IconCheck, IconTraffic, IconLink, IconContent, IconTarget, IconAlert,
} from "../icons";

type Tab = "health" | "onpage" | "crawl" | "roadmap";

const TABS: { key: Tab; label: string }[] = [
  { key: "health", label: "Site health" },
  { key: "onpage", label: "On-page issues" },
  { key: "crawl", label: "Crawlability" },
  { key: "roadmap", label: "Not yet available" },
];

type LowCtrRow = { page: string; impressions: number; ctr: number };
type SeriesRow = { d?: string; captured_at: string; site_health: number | null };

export default function TechnicalPage() {
  const { brand } = usePortalAuth();
  const { summary } = usePortalSummary(brand?.id);
  const { data: platform, loading: pLoading } = usePlatformData(brand?.id);

  const [lowCtr, setLowCtr] = useState<LowCtrRow[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("health");

  useEffect(() => {
    if (!brand?.id) return;
    let cancelled = false;
    setLoading(true);
    authedFetch(`/api/analytics?brand=${brand.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setLowCtr(Array.isArray(d?.lowCtrPages) ? d.lowCtrPages : []);
        setSeries(Array.isArray(d?.series) ? d.series : []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brand?.id]);

  if (!brand) return null;

  const siteHealth = summary?.metrics.site_health ?? null;

  // Real per-page findings: the auditor materialises each high-severity issue
  // as a content draft whose rationale it prefixes with "Auditor:".
  const auditFindings = (platform?.drafts ?? []).filter(
    (d) => (d.rationale || "").startsWith("Auditor:") && d.status === "pending_review"
  );

  // The audit only writes a health score when it successfully parsed a sitemap
  // and inspected at least one page, so a non-null score is direct evidence
  // the sitemap was found and readable.
  const sitemapConfirmed = siteHealth != null;

  const healthSeries = series
    .filter((s) => s.site_health != null)
    .map((s) => ({
      date: s.d || new Date(s.captured_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      health: s.site_health as number,
    }));

  const isLoading = loading || pLoading;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Technical SEO"
        title="How your site is built"
        sub="The technical foundations Google judges you on — what we can currently measure, what we found, and what still needs a data source."
      />

      <SubNav items={TABS} value={tab} onChange={setTab} />

      {tab === "health" && (
        <div className="p-stack">
          <Panel>
            <PanelHead
              title="Site health score"
              sub="Scored from your most recent automated audit: 100, minus a weighted deduction for every issue found."
            />
            {isLoading ? (
              <div className="p-skel" style={{ height: 120 }} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
                <ScoreRing value={siteHealth} size={108} strokeWidth={10} gradient />
                <div style={{ flex: 1, minWidth: 260 }}>
                  <p className="p-panel-sub" style={{ margin: 0 }}>
                    {siteHealth == null
                      ? "Your first technical audit hasn't completed yet. It runs as part of your daily agent cycle and reads your sitemap to inspect a sample of live pages."
                      : siteHealth >= 90
                      ? "Your last audit found little or nothing to fix. We re-check daily and anything that regresses will appear under On-page issues."
                      : siteHealth >= 70
                      ? "Your site is broadly sound but the audit found issues worth fixing. They're listed under On-page issues."
                      : "The audit found significant problems. Start with the items under On-page issues — they're ordered by severity."}
                  </p>
                </div>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHead title="Health over time" sub="Every snapshot we've captured of your technical score." />
            {isLoading ? (
              <div className="p-skel" style={{ height: 200 }} />
            ) : healthSeries.length > 1 ? (
              <TrendChart
                data={healthSeries}
                dataKey="health"
                name="Site health"
                gradientId="pTechHealth"
                color="var(--green)"
                height={220}
              />
            ) : (
              <EmptyState
                icon={<IconTraffic size={22} />}
                title="Only one measurement so far"
                sub="We record your health score on every performance snapshot. Once there are at least two, the trend appears here."
              />
            )}
          </Panel>
        </div>
      )}

      {tab === "onpage" && (
        <div className="p-stack">
          <Panel>
            <PanelHead
              title="Issues found by your audit"
              badge={auditFindings.length || undefined}
              badgeTone={auditFindings.length ? "amber" : "green"}
              sub="Each item is a real problem the auditor found on a specific page, with a fix already written."
            />
            {isLoading ? (
              <div className="p-skel" style={{ height: 120 }} />
            ) : auditFindings.length === 0 ? (
              <EmptyState
                icon={<IconCheck size={22} />}
                title="Your last audit found nothing to fix"
                sub="The auditor reads your sitemap, inspects a sample of live pages and checks titles, meta descriptions, H1s and content depth. Anything it flags appears here with a fix ready to approve."
              />
            ) : (
              <>
                <div className="p-tech-findings">
                  {auditFindings.map((f) => (
                    <div key={f.id} className="p-tech-finding">
                      <span className="p-tech-finding-ico"><IconAlert size={14} /></span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="p-tech-finding-title">{f.title}</div>
                        {f.target_url && (
                          <a href={f.target_url} target="_blank" rel="noreferrer" className="p-tech-finding-url">
                            {f.target_url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                          </a>
                        )}
                        <div className="p-tech-finding-why">{(f.rationale || "").replace(/^Auditor:\s*/, "")}</div>
                      </div>
                      <span className="p-chip">{f.task_type.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
                <ExecutionPanel
                  brandId={brand.id}
                  queue={auditFindings.slice(0, 5).map((f) => ({
                    id: f.id,
                    kind: "draft" as const,
                    title: f.title,
                    meta: f.target_url ? f.target_url.replace(/^https?:\/\/[^/]+/, "") || "/" : undefined,
                    status: f.status,
                  }))}
                  queueHref="/portal/content"
                  queueTotal={auditFindings.length}
                />
              </>
            )}
          </Panel>

          <Panel>
            <PanelHead
              title="Titles and descriptions that aren't earning clicks"
              badge={lowCtr.length || undefined}
              badgeTone="amber"
              sub="Google shows these pages often, but almost nobody clicks. That's a search-listing problem, not a ranking one."
            />
            {isLoading ? (
              <div className="p-skel" style={{ height: 120 }} />
            ) : lowCtr.length === 0 ? (
              <EmptyState
                icon={<IconCheck size={22} />}
                title="No underperforming listings"
                sub="Every page with meaningful impressions is earning a reasonable share of clicks."
              />
            ) : (
              <div className="p-table-wrap">
                <table className="p-table">
                  <thead><tr><th>Page</th><th>Impressions</th><th>CTR</th><th>Priority</th></tr></thead>
                  <tbody>
                    {lowCtr.map((r) => (
                      <tr key={r.page}>
                        <td>
                          <a href={r.page} target="_blank" rel="noreferrer" className="p-kwcell" style={{ color: "var(--accent)", textDecoration: "none" }}>
                            {r.page.replace(/^https?:\/\/[^/]+/, "") || "/"}
                          </a>
                        </td>
                        <td>{r.impressions.toLocaleString()}</td>
                        <td>{(r.ctr * 100).toFixed(1)}%</td>
                        <td>
                          <span className={`p-badge ${r.impressions >= 500 ? "amber" : ""}`}>
                            {r.impressions >= 500 ? "High" : "Medium"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "crawl" && (
        <div className="p-stack">
          <Panel>
            <PanelHead title="What we can confirm today" />
            <div className="p-stat-grid">
              <StatTile
                label="Sitemap"
                value={sitemapConfirmed ? "Found" : "Unconfirmed"}
                tone={sitemapConfirmed ? "green" : "muted"}
              />
              <StatTile
                label="Pages inspected"
                value={sitemapConfirmed ? "Sampled daily" : "—"}
                tone={sitemapConfirmed ? "accent" : "muted"}
              />
            </div>
            <p className="p-panel-sub" style={{ margin: "16px 0 0" }}>
              {sitemapConfirmed
                ? "Your audit only produces a score after it successfully reads your sitemap and inspects live pages, so a score existing is direct evidence your sitemap is present and parseable. We sample across it rather than crawling every URL."
                : "We can't confirm your sitemap yet. The audit reads /sitemap.xml and /sitemap_index.xml — until it succeeds and produces a score, we won't claim either way."}
            </p>
          </Panel>

          <Stagger className="p-subgrid">
            <ConnectCard
              icon={<IconWebsite size={19} />}
              title="Index coverage"
              desc="Which of your pages Google has actually indexed, which are excluded, and the precise reason for each."
              unlocks={["Indexed vs excluded, page by page", "Alerts when pages fall out of the index"]}
              note="Requires the Search Console URL Inspection API, which isn't connected."
            />
            <ConnectCard
              icon={<IconLink size={19} />}
              title="Broken links & redirect chains"
              desc="Continuous scanning for links that 404 or bounce through multiple redirects, internally and outbound."
              unlocks={["Every broken link, with the page it sits on", "Redirect chains costing you crawl budget"]}
              note="Requires a full-site link crawler. Today's audit samples pages from your sitemap and doesn't follow links."
            />
            <ConnectCard
              icon={<IconTarget size={19} />}
              title="robots.txt & canonical checks"
              desc="Validation that nothing you want indexed is being blocked, and that canonical tags point where they should."
              unlocks={["robots.txt parsed and validated", "Canonical conflicts surfaced"]}
              note="Requires the auditor to fetch and store robots.txt and per-page canonical tags."
            />
          </Stagger>
        </div>
      )}

      {tab === "roadmap" && (
        <div className="p-stack">
          <Panel>
            <PanelHead title="Why some checks aren't here yet" />
            <p className="p-panel-sub" style={{ margin: 0 }}>
              Your audit currently reads each sampled page&apos;s <b>title</b>, <b>meta description</b>,{" "}
              <b>H1</b> and <b>word count</b>, then keeps a score and the issues worth fixing — it doesn&apos;t
              retain the raw per-page data. The checks below each need a capability the platform doesn&apos;t
              have yet, and we&apos;d rather name that plainly than show you an empty chart or a made-up number.
            </p>
          </Panel>

          <Stagger className="p-subgrid">
            <ConnectCard
              icon={<IconContent size={19} />}
              title="Duplicate titles & H1s"
              desc="Find pages competing with each other because they share the same title or heading."
              unlocks={["Every duplicate grouped together", "Which page should win each term"]}
              note="Needs per-page titles and H1s stored for the whole site. The audit samples around a dozen pages and keeps only the issues, not the raw values."
            />
            <ConnectCard
              icon={<IconContent size={19} />}
              title="Missing alt text & oversized pages"
              desc="Images without descriptions, and pages heavy enough to hurt load time."
              unlocks={["Every image missing alt text", "Pages ranked by weight"]}
              note="The auditor doesn't currently parse images or measure page weight."
            />
            <ConnectCard
              icon={<IconTraffic size={19} />}
              title="Core Web Vitals"
              desc="Loading, interactivity and layout stability on mobile and desktop, tracked against Google's thresholds."
              unlocks={["LCP, INP and CLS over time", "Alerts when a release slows you down"]}
              note="Requires the PageSpeed Insights or CrUX API, which isn't connected."
            />
            <ConnectCard
              icon={<IconTarget size={19} />}
              title="Schema markup"
              desc="Checks your LocalBusiness, Service, FAQ and Review structured data and generates what's missing."
              unlocks={["Coverage of every schema type that applies", "Eligibility for rich results"]}
              note="Requires the auditor to extract and validate structured data per page."
            />
            <ConnectCard
              icon={<IconLink size={19} />}
              title="Internal linking opportunities"
              desc="Pages that should link to each other based on topic overlap — one of the highest-leverage, lowest-effort wins in SEO."
              unlocks={["Suggested links with anchor text", "Orphan pages with no links in"]}
              note="Requires a site-wide link graph, which means crawling every page rather than sampling."
            />
          </Stagger>
        </div>
      )}
    </div>
  );
}
