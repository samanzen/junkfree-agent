"use client";
import { useState } from "react";
import Link from "next/link";
import { usePortalAuth } from "@/lib/portalAuth";
import { usePlatformData, type Citation } from "../_data";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import ScoreRing from "../_components/ScoreRing";
import StatTile from "../_components/StatTile";
import EmptyState from "../_components/EmptyState";
import ConnectCard from "../_components/ConnectCard";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger, StaggerItem } from "../_components/motion";
import { IconLocalSeo, IconReviews, IconExternal } from "../icons";

type Tab = "overview" | "gbp" | "citations" | "rankings" | "mappack";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "gbp", label: "Google Business Profile" },
  { key: "citations", label: "Citations & NAP" },
  { key: "rankings", label: "Local Rankings" },
  { key: "mappack", label: "Map Pack" },
];

export default function LocalSeoPage() {
  const { brand } = usePortalAuth();
  const { data, loading } = usePlatformData(brand?.id);
  const [tab, setTab] = useState<Tab>("overview");

  if (!brand) return null;

  const citations = data?.citations ?? [];
  const reviews = data?.reviews ?? [];
  const live = citations.filter((c) => c.status === "live").length;
  const actionable = citations.filter((c) => c.status !== "live" && c.status !== "skipped");
  const citationScore = citations.length ? Math.round((live / citations.length) * 100) : null;
  const rated = reviews.filter((r) => typeof r.rating === "number");
  const avgRating = rated.length
    ? rated.reduce((s, r) => s + (r.rating as number), 0) / rated.length
    : null;
  const gbpConnected = !!brand.gbp_location_id;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Local SEO"
        title="Getting found nearby"
        sub={brand.service_area
          ? `How visible your business is to people searching in ${brand.service_area}.`
          : "How visible your business is to people searching in your area."}
      />

      <SubNav items={TABS} value={tab} onChange={setTab} />

      {loading ? (
        <div className="p-stack">
          <div className="p-skel" style={{ height: 160 }} />
          <div className="p-skel" style={{ height: 280 }} />
        </div>
      ) : tab === "overview" ? (
        <div className="p-stack">
          <Stagger className="p-score-grid">
            <StaggerItem className="p-score-card">
              <ScoreRing value={citationScore} size={68} strokeWidth={7} />
              <div className="p-score-label">Citation Score</div>
              {citationScore == null && <div className="p-score-locked">No listings tracked yet</div>}
            </StaggerItem>
            <StaggerItem className="p-score-card">
              <ScoreRing value={null} size={68} strokeWidth={7} />
              <div className="p-score-label">Google Business Profile</div>
              <div className="p-score-locked">{gbpConnected ? "Awaiting first sync" : "Not connected"}</div>
            </StaggerItem>
            <StaggerItem className="p-score-card">
              <ScoreRing value={null} size={68} strokeWidth={7} />
              <div className="p-score-label">NAP Consistency</div>
              <div className="p-score-locked">Not connected</div>
            </StaggerItem>
            <StaggerItem className="p-score-card">
              <div style={{ fontSize: 25, fontWeight: 640, letterSpacing: "-.03em", marginBottom: 10, marginTop: 12 }}>
                {avgRating != null ? avgRating.toFixed(1) : <span style={{ color: "var(--muted2)" }}>—</span>}
              </div>
              <div className="p-score-label">Average Rating</div>
              {avgRating == null && <div className="p-score-locked">No reviews yet</div>}
            </StaggerItem>
          </Stagger>

          <div className="p-2col">
            <Panel>
              <PanelHead title="Local opportunities" badge={actionable.length || undefined} badgeTone="amber"
                sub="Directories and local listings where being listed would help you rank." />
              {actionable.length === 0 ? (
                <EmptyState icon="✓" title="No open listing tasks" sub="Every listing we've found for you is either live or intentionally skipped." />
              ) : (
                <CitationList rows={actionable.slice(0, 8)} />
              )}
            </Panel>

            <Panel>
              <PanelHead title="Reviews at a glance" />
              <Stagger className="p-stat-grid">
                <StatTile label="Total reviews" value={reviews.length || "—"} tone={reviews.length ? "pink" : "muted"} />
                <StatTile label="Awaiting reply" value={reviews.filter((r) => r.status === "pending_review").length || "—"} tone="amber" />
                <StatTile label="Avg. rating" value={avgRating != null ? avgRating.toFixed(1) : "—"} tone={avgRating != null ? "green" : "muted"} />
              </Stagger>
              <Link href="/portal/reviews" className="p-btn ghost" style={{ marginTop: 14 }}>
                Manage reviews <IconExternal size={13} />
              </Link>
            </Panel>
          </div>
        </div>
      ) : tab === "gbp" ? (
        <div className="p-stack">
          {gbpConnected ? (
            <Panel>
              <PanelHead title="Google Business Profile" badge="Linked" badgeTone="green" />
              <p className="p-panel-sub" style={{ margin: 0 }}>
                Location ID <code>{brand.gbp_location_id}</code> is linked to your account. Profile
                insights — views, searches, calls and direction requests — will appear here once
                the Business Profile sync is switched on.
              </p>
            </Panel>
          ) : (
            <Stagger className="p-subgrid">
              <ConnectCard
                icon={<IconLocalSeo size={17} />}
                title="Connect your Google Business Profile"
                desc="Your Business Profile drives the map pack — the three local results Google shows above everything else. Connecting it unlocks profile views, search terms, calls and direction requests."
                note="Ask your account manager to link your profile."
              />
              <ConnectCard
                title="Profile completeness"
                desc="Once connected, we score your profile on hours, categories, services, photos and description — and tell you exactly what's missing."
              />
              <ConnectCard
                title="Google Posts performance"
                desc="See which of your published Google Posts drive the most views and clicks, and get new ones drafted automatically."
              />
            </Stagger>
          )}
        </div>
      ) : tab === "citations" ? (
        <div className="p-stack">
          <Panel>
            <PanelHead title="Citation score" sub="The share of your tracked directory listings that are live." />
            <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <ScoreRing value={citationScore} size={96} strokeWidth={9} />
              <Stagger className="p-stat-grid" style={{ flex: 1, minWidth: 240 }}>
                <StatTile label="Live" value={live || "—"} tone="green" />
                <StatTile label="Outstanding" value={actionable.length || "—"} tone="amber" />
                <StatTile label="Total tracked" value={citations.length || "—"} tone="muted" />
              </Stagger>
            </div>
          </Panel>

          <Panel>
            <PanelHead title="All listings" badge={citations.length || undefined} />
            {citations.length === 0 ? (
              <EmptyState icon="📇" title="No listings tracked yet" sub="Directory and citation opportunities appear here after your agents run their local SEO pass." />
            ) : (
              <CitationList rows={citations} />
            )}
          </Panel>

          <Stagger className="p-subgrid">
            <ConnectCard
              title="NAP consistency monitoring"
              desc="Automatically checks that your Name, Address and Phone number match exactly across every directory — mismatches are one of the most common reasons local rankings stall."
              note="Requires directory monitoring to be enabled."
            />
          </Stagger>
        </div>
      ) : tab === "rankings" ? (
        <Panel>
          <PanelHead title="Local rankings" sub="Where you rank for the searches that matter in your area." />
          <EmptyState
            icon="📍"
            title="See your full keyword rankings in Intelligence"
            sub="Your live ranking positions, movement and opportunities are all tracked there. Location-segmented local rankings (per city / per suburb) arrive with grid tracking."
            action={<Link href="/portal/intelligence" className="p-btn primary">Open Intelligence</Link>}
          />
        </Panel>
      ) : (
        <Stagger className="p-subgrid">
          <ConnectCard
            icon={<IconLocalSeo size={17} />}
            title="Map pack tracking"
            desc="Track your position in Google's local 3-pack for each of your core services, and see how that changes week to week."
            note="Requires Google Business Profile to be connected."
          />
          <ConnectCard
            title="Geo-grid rankings"
            desc="Visualise how your rankings change across a grid of points around your service area — so you can see exactly where you're strong and where competitors beat you."
          />
          <ConnectCard
            icon={<IconReviews size={17} />}
            title="Competitor map comparison"
            desc="See which businesses outrank you in the map pack, along with their rating, review count and category setup."
          />
        </Stagger>
      )}
    </div>
  );
}

function CitationList({ rows }: { rows: Citation[] }) {
  return (
    <div className="p-table-wrap">
      <table className="p-table">
        <thead>
          <tr><th>Directory</th><th>Category</th><th>Status</th><th>Why it matters</th></tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="p-kwcell" style={{ color: "var(--accent)", textDecoration: "none" }}>
                    {c.name}
                  </a>
                ) : <span className="p-kwcell">{c.name}</span>}
              </td>
              <td>{c.category ? <span className="p-chip">{c.category}</span> : <span className="p-na">—</span>}</td>
              <td><CitationStatus status={c.status} /></td>
              <td style={{ color: "var(--muted)", fontSize: 12.5, maxWidth: 380 }}>
                {c.rationale || <span className="p-na">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CitationStatus({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    live: { cls: "green", label: "Live" },
    in_progress: { cls: "amber", label: "In progress" },
    suggested: { cls: "accent", label: "Suggested" },
    skipped: { cls: "", label: "Skipped" },
  };
  const s = map[status] || { cls: "", label: status };
  return <span className={`p-badge ${s.cls}`}>{s.label}</span>;
}
