"use client";
import { useEffect, useMemo, useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import { authedFetch } from "@/lib/authedFetch";
import { usePlatformData } from "../_data";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import EmptyState from "../_components/EmptyState";
import StatTile from "../_components/StatTile";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger } from "../_components/motion";
import OpportunityCard from "./_OpportunityCard";
import {
  buildOpportunities, type Opportunity, type KeywordRow,
  type MoveRow, type LowCtrRow, type StrikingRow,
} from "./_engine";
import { IconSparkle } from "../icons";

type Filter = "all" | "rankings" | "content" | "reputation" | "local" | "setup";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "rankings", label: "Rankings" },
  { key: "content", label: "Content" },
  { key: "reputation", label: "Reviews" },
  { key: "local", label: "Local" },
  { key: "setup", label: "Setup" },
];

export default function OpportunitiesPage() {
  const { brand } = usePortalAuth();
  const { data: platform, loading: pLoading } = usePlatformData(brand?.id);

  const [striking, setStriking] = useState<StrikingRow[]>([]);
  const [lowCtr, setLowCtr] = useState<LowCtrRow[]>([]);
  const [declining, setDeclining] = useState<MoveRow[]>([]);
  const [lost, setLost] = useState<MoveRow[]>([]);
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  // Reads only endpoints that already exist. No new API was added for this page.
  useEffect(() => {
    if (!brand?.id) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      authedFetch(`/api/analytics?brand=${brand.id}`).then((r) => r.json()).catch(() => ({})),
      authedFetch(`/api/intelligence/winners-losers?brand=${brand.id}`).then((r) => r.json()).catch(() => ({})),
      authedFetch(`/api/intelligence/keywords?brand=${brand.id}&limit=100`).then((r) => r.json()).catch(() => ({})),
    ])
      .then(([analytics, wl, kws]) => {
        if (cancelled) return;
        setStriking(Array.isArray(analytics?.keywords) ? analytics.keywords : []);
        setLowCtr(Array.isArray(analytics?.lowCtrPages) ? analytics.lowCtrPages : []);
        setDeclining(Array.isArray(wl?.drops) ? wl.drops : []);
        setLost(Array.isArray(wl?.lost_keywords) ? wl.lost_keywords : []);
        setKeywords(Array.isArray(kws?.keywords) ? kws.keywords : []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [brand?.id]);

  const opportunities: Opportunity[] = useMemo(() => {
    if (!brand) return [];
    return buildOpportunities({
      striking, lowCtr, declining, lost, keywords,
      counts: {
        pendingDrafts: (platform?.drafts ?? [])
          .filter((d) => d.status === "pending_review")
          .map((d) => ({
            id: d.id,
            title: d.title.replace(/^(Blog|Page|New blog|New page|Audit \+ rewrite|Meta rewrite|Intent fix):\s*/i, ""),
            meta: d.target_keyword ? `Target: ${d.target_keyword}` : undefined,
            status: d.status,
          })),
        pendingReviews: (platform?.reviews ?? [])
          .filter((r) => r.status === "pending_review")
          .map((r) => ({
            id: r.id,
            title: `${r.rating ?? "—"}★ from ${r.reviewer_name || "Anonymous"}`,
            meta: r.review_text ? r.review_text.slice(0, 90) + (r.review_text.length > 90 ? "…" : "") : undefined,
            status: r.status,
          })),
        openCitations: platform?.citations.filter((c) => c.status !== "live" && c.status !== "skipped").length ?? 0,
        gscConnected: !!brand.gsc_property,
        gbpConnected: !!brand.gbp_location_id,
      },
    });
  }, [brand, striking, lowCtr, declining, lost, keywords, platform]);

  const counts = useMemo(() => ({
    critical: opportunities.filter((o) => o.priority === "critical").length,
    high: opportunities.filter((o) => o.priority === "high").length,
    quickWins: opportunities.filter((o) => o.difficulty === "easy").length,
    automatable: opportunities.filter((o) => o.capabilities.some((c) => c.exec === "agent")).length,
  }), [opportunities]);

  const visible = filter === "all" ? opportunities : opportunities.filter((o) => o.category === filter);
  const isLoading = loading || pLoading;

  if (!brand) return null;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="AI Opportunities"
        title="What to do next"
        sub="Every recommendation below is built from your own live data, ranked by the difference it will make. Start at the top."
      />

      {isLoading ? (
        <div className="p-stack">
          <div className="p-skel" style={{ height: 96 }} />
          {[...Array(4)].map((_, i) => <div key={i} className="p-skel" style={{ height: 132 }} />)}
        </div>
      ) : opportunities.length === 0 ? (
        <EmptyState
          icon={<IconSparkle size={22} />}
          title="Nothing needs your attention"
          sub="We found no outstanding opportunities in your current data. As your agents keep running and new ranking data arrives, anything worth acting on will appear here."
        />
      ) : (
        <>
          <Panel>
            <PanelHead title="At a glance" sub="Across everything we can currently see." />
            <div className="p-stat-grid">
              <StatTile label="Total opportunities" value={opportunities.length} tone="accent" />
              <StatTile label="Critical" value={counts.critical || "—"} tone={counts.critical ? "red" : "muted"} />
              <StatTile label="High priority" value={counts.high || "—"} tone={counts.high ? "amber" : "muted"} />
              <StatTile label="Quick wins" value={counts.quickWins || "—"} tone={counts.quickWins ? "green" : "muted"} />
              <StatTile label="AI can start" value={counts.automatable || "—"} tone={counts.automatable ? "blue" : "muted"} />
            </div>
          </Panel>

          <SubNav items={FILTERS} value={filter} onChange={setFilter} />

          {visible.length === 0 ? (
            <EmptyState
              title="Nothing in this category"
              sub="Try another filter — your other opportunities are still listed under Everything."
            />
          ) : (
            <Stagger className="p-opp-list" stagger={0.05}>
              {visible.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} brandId={brand.id} />
              ))}
            </Stagger>
          )}
        </>
      )}
    </div>
  );
}
