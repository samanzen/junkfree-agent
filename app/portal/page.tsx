"use client";
import Link from "next/link";
import { usePortalAuth } from "@/lib/portalAuth";
import {
  usePlatformData, usePortalSummary, useAgentActivity,
  computeSeoScore, computeLocalScore, computeOverallHealth, greeting,
  type PortalSummary, type PlatformData,
} from "./_data";
import AgentActivity from "./_components/AgentActivity";
import ScoreRing from "./_components/ScoreRing";
import MetricCard from "./_components/MetricCard";
import TrendChart from "./_components/TrendChart";
import AiSummary from "./_components/AiSummary";
import EmptyState from "./_components/EmptyState";
import { Panel, PanelHead } from "./_components/Panel";
import MissionHero, { type QuickAction } from "./_components/MissionHero";
import AiBriefing, { type Signal } from "./_components/AiBriefing";
import { Stagger, StaggerItem } from "./_components/motion";
import {
  IconLock, IconExternal, IconTraffic, IconKey, IconTarget,
  IconLink, IconLeads, IconPhone, IconReviews, IconChevron,
  IconCheck, IconContent,
} from "./icons";

type PriorityTone = "accent" | "green" | "amber" | "red" | "pink";
type Priority = { text: string; sub?: string; tone: PriorityTone; href?: string };

// Priorities are derived strictly from real rows the platform already has.
// If nothing needs attention we say so rather than padding the list.
function buildPriorities(summary: PortalSummary | null, platform: PlatformData | null): Priority[] {
  const out: Priority[] = [];
  if (!summary || !platform) return out;

  const pendingDrafts = platform.drafts.filter((d) => d.status === "pending_review").length;
  if (pendingDrafts > 0) {
    out.push({
      text: `Review ${pendingDrafts} piece${pendingDrafts > 1 ? "s" : ""} of content`,
      sub: "Drafted by your AI team and waiting for approval",
      tone: "accent", href: "/portal/content",
    });
  }

  const pendingReviews = platform.reviews.filter((r) => r.status === "pending_review").length;
  if (pendingReviews > 0) {
    out.push({
      text: `Respond to ${pendingReviews} review${pendingReviews > 1 ? "s" : ""}`,
      sub: "Replies are already drafted for you",
      tone: "pink", href: "/portal/reviews",
    });
  }

  const openCitations = platform.citations.filter((c) => c.status !== "live" && c.status !== "skipped").length;
  if (openCitations > 0) {
    out.push({
      text: `Fix ${openCitations} citation listing${openCitations > 1 ? "s" : ""}`,
      sub: "Consistent listings help you rank in the map pack",
      tone: "amber", href: "/portal/local-seo",
    });
  }

  const opps = summary.opportunities?.length || 0;
  if (opps > 0) {
    out.push({
      text: `${opps} keyword${opps > 1 ? "s are" : " is"} close to page 1`,
      sub: "A small content push could move these up",
      tone: "green", href: "/portal/intelligence",
    });
  }

  return out.slice(0, 4);
}

export default function PortalDashboard() {
  const { brand } = usePortalAuth();
  const { summary, loading: sLoading } = usePortalSummary(brand?.id);
  const { data: platform, loading: pLoading } = usePlatformData(brand?.id);
  // Agent activity loads independently of the metrics: it is the fastest query
  // on the page and should not wait behind Search Console.
  const { activity, loading: aLoading } = useAgentActivity(brand?.id);

  if (!brand) return null;
  if (sLoading || pLoading || !summary) return <DashboardSkeleton />;

  const m = summary.metrics;
  const seoScore = computeSeoScore(m);
  const localScore = computeLocalScore(summary.activity);
  const websiteHealth = m.site_health;
  const aiVisibility = m.ai_visibility;
  const gbpScore: number | null = null; // no GBP integration connected yet
  const overall = computeOverallHealth([seoScore, localScore, websiteHealth]);

  const priorities = buildPriorities(summary, platform);
  const reviewCount = platform?.reviews.length ?? null;
  const hasChart = (summary.chart?.length || 0) > 1;

  // ── Presentation-only views of data already loaded above. Nothing here
  // fetches, computes a score, or invents a figure; each line is a count or a
  // projection of an array the page already has in hand.
  const pendingDrafts = platform?.drafts.filter((d) => d.status === "pending_review").length ?? 0;
  const pendingReviews = platform?.reviews.filter((r) => r.status === "pending_review").length ?? 0;
  const openCitations = platform?.citations.filter((c) => c.status !== "live" && c.status !== "skipped").length ?? 0;
  const oppCount = summary.opportunities?.length ?? 0;

  const trafficSeries = summary.chart?.map((c) => c.traffic) ?? [];
  const keywordSeries = summary.chart?.map((c) => c.keywords) ?? [];

  // The single opportunity with the widest reach, straight from the list the
  // API already returned (ordered by impressions).
  const topOpportunity = summary.opportunities?.length
    ? [...summary.opportunities].sort((a, b) => b.impressions - a.impressions)[0]
    : null;

  const signals: Signal[] = [
    oppCount > 0 && { count: oppCount, label: oppCount === 1 ? "keyword within reach of page 1" : "keywords within reach of page 1", tone: "green" as const, href: "/portal/intelligence" },
    pendingDrafts > 0 && { count: pendingDrafts, label: pendingDrafts === 1 ? "article ready for your review" : "articles ready for your review", tone: "accent" as const, href: "/portal/content" },
    pendingReviews > 0 && { count: pendingReviews, label: pendingReviews === 1 ? "review reply drafted" : "review replies drafted", tone: "pink" as const, href: "/portal/reviews" },
    openCitations > 0 && { count: openCitations, label: openCitations === 1 ? "listing needs attention" : "listings need attention", tone: "amber" as const, href: "/portal/local-seo" },
  ].filter(Boolean) as Signal[];

  const quickActions: QuickAction[] = [
    pendingDrafts > 0 && { label: "Review content", count: pendingDrafts, href: "/portal/content", tone: "accent" as const },
    pendingReviews > 0 && { label: "Reply to reviews", count: pendingReviews, href: "/portal/reviews", tone: "pink" as const },
    { label: "Ask your AI assistant", href: "/portal/assistant", tone: "accent" as const },
  ].filter(Boolean) as QuickAction[];

  return (
    <div className="p-home">
      {/* Mission Control */}
      <MissionHero
        greeting={greeting()}
        title={brand.name}
        subtitle={summary.brand?.service_area
          ? `Your search performance across ${summary.brand.service_area}, updated continuously.`
          : "Your search performance, updated continuously."}
        score={overall}
        stats={[
          { label: "Organic traffic", value: m.organic_traffic, delta: m.traffic_delta },
          { label: "Ranking keywords", value: m.organic_keywords, delta: m.keywords_delta },
          { label: "Avg. position", value: m.avg_position, decimals: 1, delta: m.position_delta, invert: true },
          { label: "Site health", value: m.site_health, suffix: "%" },
        ]}
        actions={quickActions}
      />

      {/* AI intelligence */}
      <AiBriefing
        signals={signals}
        topOpportunity={topOpportunity}
        summarySlot={<AiSummary brandId={brand.id} section="business overview" brandName={brand.name} data={m} />}
      />

      {/* Health scores */}
      <section>
        <SectionLabel title="Health scores" sub="Each score is built from the data we hold today." />
        {/* Five equal cards gave the same visual weight to a measured score and
            to a source that isn't connected — so two thirds of the row was
            placeholder, and it read as the emptiest part of the page.
            Measured scores keep their cards; unavailable ones collapse into a
            single quiet line that says what would unlock them. Nothing is
            hidden and no value is invented — absence is just no longer
            occupying the same space as data. */}
        {(() => {
          const scores = [
            { label: "SEO Score", value: seoScore, hint: "Needs ranking data" },
            { label: "Local SEO", value: localScore, hint: "Needs citation data" },
            { label: "Website Health", value: websiteHealth, hint: "Runs with your next audit" },
            // 100 or 0 is a yes/no, not a percentage — the hint says which, so
            // the number is never read as a score it isn't.
            {
              label: "AI Visibility", value: aiVisibility,
              hint: aiVisibility == null
                ? "Checked on your next agent run"
                : aiVisibility >= 100
                ? "AI assistants recommend you for your main service search"
                : "Not yet named when AI assistants are asked for your service",
            },
            { label: "Google Business Profile", value: gbpScore, hint: "Connect your profile" },
          ];
          const measured = scores.filter((s) => s.value != null);
          const pending = scores.filter((s) => s.value == null);
          return (
            <>
              {measured.length > 0 && (
                <div className="p-score-grid">
                  {measured.map((s) => (
                    <ScoreCard key={s.label} label={s.label} value={s.value} hint={s.hint} />
                  ))}
                </div>
              )}
              {pending.length > 0 && (
                <div className="p-score-pending">
                  <IconLock size={12} />
                  <span className="p-score-pending-lead">Not measured yet</span>
                  {pending.map((s) => (
                    <span key={s.label} className="p-score-pending-item">
                      <b>{s.label}</b> — {s.hint}
                    </span>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </section>

      {/* Performance + what needs attention */}
      <div className="p-2col">
        <div className="p-stack">
          <Panel>
            <PanelHead title="Organic traffic" sub="Estimated visitors arriving from Google over time." />
            {/* The one large data moment on this screen. At 264px the chart was
                just another card; at 380 it reads as the page's subject and the
                trend is actually legible. */}
            {hasChart ? (
              <TrendChart data={summary.chart} dataKey="traffic" name="Est. traffic" gradientId="pHomeTraffic" height={380} />
            ) : (
              <EmptyState
                icon={<IconTraffic size={22} />}
                title="Your trend is still building"
                sub="We capture a performance snapshot on every run. Once there are a few, this chart shows exactly where your traffic is heading."
              />
            )}
          </Panel>

          <Panel>
            <PanelHead title="Business metrics" sub="Live numbers from Search Console and your ranking data." />
            <Stagger className="p-kpi-grid" stagger={0.045}>
              {/* Each metric declares its DIMENSION, which fixes its colour
                  across the whole product — the grid is scannable by hue. */}
              <MetricCard label="Organic Traffic" value={m.organic_traffic} delta={m.traffic_delta} dimension="traffic" icon={<IconTraffic size={16} />} hint="Est. monthly visitors" series={trafficSeries} />
              <MetricCard label="Ranking Keywords" value={m.organic_keywords} delta={m.keywords_delta} dimension="keywords" icon={<IconKey size={16} />} hint="Keywords you appear for" series={keywordSeries} />
              <MetricCard label="Avg. Position" value={m.avg_position} delta={m.position_delta} dimension="position" icon={<IconTarget size={16} />} decimals={1} invert hint="Lower is better" />
              <MetricCard label="Backlinks" value={m.backlinks} delta={m.backlinks_delta} dimension="backlinks" icon={<IconLink size={16} />} hint="Sites linking to you" />
              <MetricCard label="Reviews" value={reviewCount} dimension="reviews" icon={<IconReviews size={16} />} hint="Drafted replies" />
              <MetricCard label="Leads" locked lockedHint="Connect lead tracking" icon={<IconLeads size={16} />} />
              <MetricCard label="Calls" locked lockedHint="Connect call tracking" icon={<IconPhone size={16} />} />
              <MetricCard label="Conversions" locked lockedHint="Connect analytics" icon={<IconTarget size={16} />} />
            </Stagger>
          </Panel>
        </div>

        <div className="p-stack">
          <Panel>
            <PanelHead
              title="Needs your attention"
              badge={priorities.length || undefined}
              sub="Ordered by impact on your rankings."
            />
            {priorities.length > 0 ? (
              <div className="p-priority-list">
                {priorities.map((p, i) => {
                  const body = (
                    <>
                      <span className="p-priority-dot" style={{ background: `var(--${p.tone})` }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="p-priority-text">{p.text}</div>
                        {p.sub && <div className="p-priority-sub">{p.sub}</div>}
                      </div>
                      {p.href && <IconChevron size={13} className="p-priority-arrow" />}
                    </>
                  );
                  return p.href
                    ? <Link key={i} href={p.href} className="p-priority p-priority-link">{body}</Link>
                    : <div key={i} className="p-priority">{body}</div>;
                })}
              </div>
            ) : (
              <EmptyState
                icon={<IconCheck size={22} />}
                title="You're all caught up"
                sub="Nothing needs a decision from you right now. Your agents keep working in the background and new priorities appear here automatically."
              />
            )}
          </Panel>

          {/* What the platform is doing on its own. Sits directly under the
              priorities because between them they answer the two questions a
              customer actually has: what needs me, and what is the system
              doing without me. */}
          <Panel>
            <PanelHead
              title="Agent activity"
              sub="Every job your agents have run, newest first."
              action={
                activity?.active ? (
                  <span className="p-live">
                    <i />
                    <span className="p-live-count">
                      {activity.counts.running + activity.counts.queued}
                    </span>
                    {activity.counts.running > 0 ? "running" : "queued"}
                  </span>
                ) : undefined
              }
            />
            <AgentActivity activity={activity} loading={aLoading} />
          </Panel>

          <Panel>
            <PanelHead title="This month" />
            <div className="p-ministat-row">
              <MiniStat n={summary.activity.published_this_month} label="Published" color="var(--accent)" />
              <MiniStat n={summary.activity.gbp_posts_drafted} label="Google posts" color="var(--green)" />
              <MiniStat n={summary.activity.citations_live} label="Citations live" color="var(--amber)" />
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Recent activity" />
            {summary.activity.recent_content.length > 0 ? (
              <div className="p-feed">
                {summary.activity.recent_content.slice(0, 6).map((c, i) => (
                  <div key={i} className="p-feed-item">
                    {/* Azure, because every item here was written by the
                        platform's own content agent (lib/steps.ts stepContent)
                        — not a stylistic choice, an accurate one. */}
                    <span className="p-feed-icon" style={{ background: "var(--system-soft)", color: "var(--system)" }}>
                      <IconContent size={13} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="p-feed-title">{c.title}</div>
                      <div className="p-feed-meta">
                        {c.keyword ? `${c.keyword} · ` : ""}
                        {new Date(c.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<IconContent size={20} />}
                title="Nothing published yet"
                sub="Everything your AI team publishes will show up here."
              />
            )}
          </Panel>

          <a href={brand.site_url} target="_blank" rel="noreferrer" className="p-panel p-site-card">
            <span>View live website</span>
            <IconExternal size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="p-sectionlabel">
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </div>
  );
}

function ScoreCard({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  // A ring at 0 is indistinguishable from a ring that never loaded: both are an
  // empty circle. "Local SEO" rendered exactly that — no arc, no explanation —
  // which reads as broken rather than as "nothing measured yet".
  //
  // The number is NEVER altered (a real 0 stays 0). What changes is that a card
  // at the bottom of its range now always carries the line explaining what the
  // score is waiting on, so an empty ring is never unexplained.
  const needsContext = value == null || value === 0;
  return (
    <StaggerItem className="p-score-card">
      <ScoreRing value={value} size={68} strokeWidth={7} />
      <div className="p-score-label">{label}</div>
      {needsContext && (
        <div className="p-score-locked"><IconLock size={11} /> {hint}</div>
      )}
    </StaggerItem>
  );
}

function MiniStat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="p-ministat">
      <div className="p-ministat-n" style={{ color }}>{n}</div>
      <div className="p-ministat-label">{label}</div>
    </div>
  );
}

// Mirrors the real composition so the page doesn't reflow when data lands.
function DashboardSkeleton() {
  return (
    <div className="p-home">
      <div className="p-skel" style={{ height: 312, borderRadius: 26 }} />
      <div className="p-skel" style={{ height: 214, borderRadius: 26 }} />
      <div>
        <div className="p-skel" style={{ height: 15, width: 130, marginBottom: 16, borderRadius: 6 }} />
        <div className="p-score-grid">
          {[...Array(5)].map((_, i) => <div key={i} className="p-skel" style={{ height: 156 }} />)}
        </div>
      </div>
      <div className="p-2col">
        <div className="p-stack">
          <div className="p-skel" style={{ height: 348 }} />
          <div className="p-skel" style={{ height: 330 }} />
        </div>
        <div className="p-stack">
          <div className="p-skel" style={{ height: 268 }} />
          <div className="p-skel" style={{ height: 138 }} />
          <div className="p-skel" style={{ height: 250 }} />
        </div>
      </div>
    </div>
  );
}
