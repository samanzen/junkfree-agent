"use client";
import Link from "next/link";
import { usePortalAuth } from "@/lib/portalAuth";
import {
  usePlatformData, usePortalSummary,
  computeSeoScore, computeLocalScore, computeOverallHealth, greeting,
  type PortalSummary, type PlatformData,
} from "./_data";
import ScoreRing from "./_components/ScoreRing";
import MetricCard from "./_components/MetricCard";
import TrendChart from "./_components/TrendChart";
import AiSummary from "./_components/AiSummary";
import EmptyState from "./_components/EmptyState";
import { Panel, PanelHead } from "./_components/Panel";
import { IconLock, IconExternal } from "./icons";

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

  return (
    <div className="p-home">
      {/* Hero */}
      <section className="p-hero-card">
        <div>
          <div className="p-eyebrow">{greeting()}</div>
          <h1 className="p-h1">{brand.name}</h1>
          <p className="p-sub">
            {summary.brand?.service_area
              ? `Here's how your business is performing in ${summary.brand.service_area}.`
              : "Here's how your business is performing right now."}
          </p>
        </div>
        <div className="p-hero-ring">
          <ScoreRing value={overall} size={116} strokeWidth={10} label="Business Health" big />
        </div>
      </section>

      {/* Score cards */}
      <div className="p-score-grid">
        <ScoreCard label="SEO Score" value={seoScore} hint="Needs ranking data" />
        <ScoreCard label="Local SEO" value={localScore} hint="Needs citation data" />
        <ScoreCard label="Website Health" value={websiteHealth} hint="Runs with your next audit" />
        <ScoreCard label="AI Visibility" value={aiVisibility} hint="Coming soon" />
        <ScoreCard label="Google Business Profile" value={gbpScore} hint="Connect your profile" />
      </div>

      <div className="p-2col">
        <div className="p-stack">
          {/* Today's priorities */}
          <Panel>
            <PanelHead
              title="Today's priorities"
              badge={priorities.length || undefined}
              sub="The highest-impact things you could do right now."
            />
            {priorities.length > 0 ? (
              <div className="p-priority-list">
                {priorities.map((p, i) => {
                  const body = (
                    <>
                      <span className="p-priority-dot" style={{ background: `var(--${p.tone})` }} />
                      <div>
                        <div className="p-priority-text">{p.text}</div>
                        {p.sub && <div className="p-priority-sub">{p.sub}</div>}
                      </div>
                    </>
                  );
                  return p.href
                    ? <Link key={i} href={p.href} className="p-priority p-priority-link">{body}</Link>
                    : <div key={i} className="p-priority">{body}</div>;
                })}
              </div>
            ) : (
              <EmptyState icon="✓" title="You're all caught up" sub="Nothing needs your attention right now. We'll surface new priorities as your agents run." />
            )}
          </Panel>

          {/* Business metrics */}
          <Panel>
            <PanelHead title="Business metrics" sub="Live numbers from Search Console and your ranking data." />
            <div className="p-kpi-grid">
              <MetricCard label="Organic Traffic" value={m.organic_traffic} delta={m.traffic_delta} color="var(--accent)" hint="Est. monthly visitors" />
              <MetricCard label="Ranking Keywords" value={m.organic_keywords} delta={m.keywords_delta} color="var(--green)" hint="Keywords you appear for" />
              <MetricCard label="Avg. Position" value={m.avg_position} delta={m.position_delta} color="var(--amber)" decimals={1} invert hint="Lower is better" />
              <MetricCard label="Reviews" value={reviewCount} color="var(--pink)" hint="Drafted replies" />
              <MetricCard label="Leads" locked lockedHint="Connect lead tracking" color="var(--blue)" />
              <MetricCard label="Calls" locked lockedHint="Connect call tracking" color="var(--blue)" />
              <MetricCard label="Conversions" locked lockedHint="Connect analytics" color="var(--blue)" />
              <MetricCard label="Backlinks" value={m.backlinks} delta={m.backlinks_delta} color="var(--blue)" hint="Sites linking to you" />
            </div>
          </Panel>

          {/* Traffic trend */}
          <Panel>
            <PanelHead title="Traffic trend" sub="Estimated organic visitors over time." />
            {hasChart ? (
              <TrendChart data={summary.chart} dataKey="traffic" name="Est. traffic" gradientId="pHomeTraffic" />
            ) : (
              <EmptyState icon="📈" title="Not enough history yet" sub="Your trend chart appears once we've captured a few snapshots of your performance." />
            )}
          </Panel>
        </div>

        <div className="p-stack">
          {/* Recent activity */}
          <Panel>
            <PanelHead title="Recent activity" />
            {summary.activity.recent_content.length > 0 ? (
              <div className="p-feed">
                {summary.activity.recent_content.slice(0, 7).map((c, i) => (
                  <div key={i} className="p-feed-item">
                    <span className="p-feed-icon" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>✎</span>
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
              <EmptyState icon="◷" title="No activity yet" sub="Published content and updates will appear here." />
            )}
          </Panel>

          {/* This month */}
          <Panel>
            <PanelHead title="This month" />
            <div className="p-ministat-row">
              <MiniStat n={summary.activity.published_this_month} label="Published" color="var(--accent)" />
              <MiniStat n={summary.activity.gbp_posts_drafted} label="Google posts" color="var(--green)" />
              <MiniStat n={summary.activity.citations_live} label="Citations live" color="var(--amber)" />
            </div>
          </Panel>

          <a href={brand.site_url} target="_blank" rel="noreferrer" className="p-panel p-site-card">
            <span>View live website</span>
            <IconExternal size={14} />
          </a>
        </div>
      </div>

      {/* AI executive summary */}
      <AiSummary brandId={brand.id} section="business overview" brandName={brand.name} data={m} />
    </div>
  );
}

function ScoreCard({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  return (
    <div className="p-score-card">
      <ScoreRing value={value} size={64} strokeWidth={7} />
      <div className="p-score-label">{label}</div>
      {value == null && (
        <div className="p-score-locked"><IconLock size={11} /> {hint}</div>
      )}
    </div>
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

function DashboardSkeleton() {
  return (
    <div className="p-home">
      <div className="p-skel" style={{ height: 148 }} />
      <div className="p-score-grid">
        {[...Array(5)].map((_, i) => <div key={i} className="p-skel" style={{ height: 148 }} />)}
      </div>
      <div className="p-2col">
        <div className="p-stack">
          <div className="p-skel" style={{ height: 240 }} />
          <div className="p-skel" style={{ height: 300 }} />
        </div>
        <div className="p-stack">
          <div className="p-skel" style={{ height: 280 }} />
          <div className="p-skel" style={{ height: 140 }} />
        </div>
      </div>
    </div>
  );
}
