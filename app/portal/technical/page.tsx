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
import ResponsiveTable from "@/app/_components/ResponsiveTable";
import LlmsTxtPanel from "./_LlmsTxtPanel";

type Tab = "health" | "onpage" | "crawl" | "roadmap";

const TABS: { key: Tab; label: string }[] = [
  { key: "health", label: "Site health" },
  { key: "onpage", label: "On-page issues" },
  { key: "crawl", label: "Crawlability" },
  { key: "roadmap", label: "Not yet available" },
];

type LowCtrRow = { page: string; impressions: number; ctr: number };
type SeriesRow = { d?: string; captured_at: string; site_health: number | null };

// Persisted per-page audit dataset (supabase/010_page_audits.sql).
type AuditPage = {
  url: string;
  http_status: number | null;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  canonical: string | null;
  robots_meta: string | null;
  word_count: number | null;
  missing_title: boolean;
  missing_meta_description: boolean;
  missing_h1: boolean;
  thin_content: boolean;
  duplicate_title: boolean;
  duplicate_meta_description: boolean;
  duplicate_h1: boolean;
};
type TechnicalData = {
  available: boolean;
  reason: string | null;
  audit_run_at?: string;
  runs?: string[];
  pages: AuditPage[];
  summary: {
    pages_audited: number;
    missing_title: number;
    missing_meta_description: number;
    missing_h1: number;
    thin_content: number;
    duplicate_title: number;
    duplicate_meta_description: number;
    duplicate_h1: number;
    missing_canonical: number;
    noindex: number;
    non_200: number;
  } | null;
};

/** Human-readable flags for one audited page. Reads only stored values. */
function pageFlags(p: AuditPage): string[] {
  const f: string[] = [];
  if (p.missing_title) f.push("No title");
  if (p.missing_meta_description) f.push("No description");
  if (p.missing_h1) f.push("No H1");
  if (p.duplicate_title) f.push("Duplicate title");
  if (p.duplicate_meta_description) f.push("Duplicate description");
  if (p.duplicate_h1) f.push("Duplicate H1");
  if (p.thin_content) f.push("Thin content");
  if (!p.canonical) f.push("No canonical");
  if ((p.robots_meta || "").toLowerCase().includes("noindex")) f.push("Noindex");
  return f;
}

export default function TechnicalPage() {
  const { brand } = usePortalAuth();
  const { summary } = usePortalSummary(brand?.id);
  const { data: platform, loading: pLoading } = usePlatformData(brand?.id);

  const [lowCtr, setLowCtr] = useState<LowCtrRow[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [tech, setTech] = useState<TechnicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("health");

  useEffect(() => {
    if (!brand?.id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      authedFetch(`/api/analytics?brand=${brand.id}`).then((r) => r.json()).catch(() => ({})),
      authedFetch(`/api/portal/technical?brand=${brand.id}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([analytics, technical]) => {
        if (cancelled) return;
        setLowCtr(Array.isArray(analytics?.lowCtrPages) ? analytics.lowCtrPages : []);
        setSeries(Array.isArray(analytics?.series) ? analytics.series : []);
        setTech(technical && typeof technical.available === "boolean" ? technical : null);
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

          {/* Per-page checks, now backed by the persisted audit dataset. */}
          <Panel>
            <PanelHead
              title="Page-level checks"
              badge={tech?.summary ? `${tech.summary.pages_audited} pages` : undefined}
              badgeTone="plain"
              sub="Run against every page your last audit inspected. Duplicates are compared across that whole set."
            />
            <p className="p-tech-note">
              <IconAlert size={13} />
              <span>
                These checks read the HTML your server sends, before any JavaScript runs. If your site
                renders its headings or text in the browser, pages can show here as missing an H1 or
                thin while still looking complete to a visitor. What your server sends is still what
                crawlers see first, so it&apos;s worth reviewing either way.
              </span>
            </p>
            {isLoading ? (
              <div className="p-skel" style={{ height: 150 }} />
            ) : !tech || !tech.available ? (
              <EmptyState
                icon={<IconAlert size={22} />}
                title="Technical dataset not enabled yet"
                sub="These checks are built and ready. They start populating once supabase/010_page_audits.sql has been applied to the database and the next daily audit runs."
              />
            ) : !tech.summary || tech.summary.pages_audited === 0 ? (
              <EmptyState
                icon={<IconWebsite size={22} />}
                title="No audit stored yet"
                sub="Your next daily audit will record every page it inspects, and these checks will populate automatically from that point on."
              />
            ) : (
              <>
                <div className="p-stat-grid">
                  <StatTile label="Missing title" value={tech.summary.missing_title || "—"} tone={tech.summary.missing_title ? "red" : "green"} />
                  <StatTile label="Missing description" value={tech.summary.missing_meta_description || "—"} tone={tech.summary.missing_meta_description ? "red" : "green"} />
                  <StatTile label="Missing H1" value={tech.summary.missing_h1 || "—"} tone={tech.summary.missing_h1 ? "amber" : "green"} />
                  <StatTile label="Duplicate titles" value={tech.summary.duplicate_title || "—"} tone={tech.summary.duplicate_title ? "amber" : "green"} />
                  <StatTile label="Duplicate descriptions" value={tech.summary.duplicate_meta_description || "—"} tone={tech.summary.duplicate_meta_description ? "amber" : "green"} />
                  <StatTile label="Duplicate H1s" value={tech.summary.duplicate_h1 || "—"} tone={tech.summary.duplicate_h1 ? "amber" : "green"} />
                  <StatTile label="Thin content" value={tech.summary.thin_content || "—"} tone={tech.summary.thin_content ? "amber" : "green"} />
                  <StatTile label="No canonical" value={tech.summary.missing_canonical || "—"} tone={tech.summary.missing_canonical ? "amber" : "green"} />
                  <StatTile label="Noindex" value={tech.summary.noindex || "—"} tone={tech.summary.noindex ? "red" : "green"} />
                  <StatTile label="Non-200" value={tech.summary.non_200 || "—"} tone={tech.summary.non_200 ? "red" : "green"} />
                </div>

                <ResponsiveTable style={{ marginTop: 18 }}>
                  <table className="p-table">
                    <thead>
                      <tr><th>Page</th><th>Status</th><th>Words</th><th>Issues</th></tr>
                    </thead>
                    <tbody>
                      {tech.pages.map((p) => {
                        const flags = pageFlags(p);
                        return (
                          <tr key={p.url}>
                            <td>
                              <a href={p.url} target="_blank" rel="noreferrer" className="p-kwcell" style={{ color: "var(--accent)", textDecoration: "none" }}>
                                {p.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                              </a>
                            </td>
                            <td>
                              <span className={`p-pos ${p.http_status === 200 ? "top3" : ""}`}>
                                {p.http_status ?? "—"}
                              </span>
                            </td>
                            <td>{p.word_count != null ? p.word_count.toLocaleString() : <span className="p-na">—</span>}</td>
                            <td>
                              {flags.length === 0
                                ? <span className="p-badge green">Clean</span>
                                : <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap" }}>
                                    {flags.map((f) => <span key={f} className="p-badge amber">{f}</span>)}
                                  </span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ResponsiveTable>
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
              <ResponsiveTable>
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
              </ResponsiveTable>
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

          {/* Surfaces the existing buildLlmsTxt() generator, which had no
              caller until Phase 8A. Not a ConnectCard — this one is real. */}
          <LlmsTxtPanel brandId={brand.id} />

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
              title="Site-wide robots.txt"
              desc="Validation that your robots.txt isn't blocking anything you want indexed."
              unlocks={["robots.txt fetched and parsed", "Blocked paths cross-checked against your sitemap"]}
              note="Per-page robots directives and canonicals ARE now recorded — see On-page issues. This card covers the site-level robots.txt file, which the auditor doesn't fetch yet."
            />
          </Stagger>
        </div>
      )}

      {tab === "roadmap" && (
        <div className="p-stack">
          <Panel>
            <PanelHead title="Why some checks aren't here yet" />
            <p className="p-panel-sub" style={{ margin: 0 }}>
              Your audit now records every page it inspects — the title, meta description, H1, canonical,
              robots directive, HTTP status and word count — so the page-level checks under{" "}
              <b>On-page issues</b> run against a real, growing dataset. The checks below still need a
              capability the platform doesn&apos;t have yet, and we&apos;d rather name that plainly than show
              you an empty chart or a made-up number.
            </p>
          </Panel>

          <Stagger className="p-subgrid">
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
