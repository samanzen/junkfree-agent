"use client";
import { useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import {
  usePlatformData, approveDraft, dismissDraft, setRowStatus,
  type Draft, type GbpPost,
} from "../_data";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import EmptyState from "../_components/EmptyState";
import ConnectCard from "../_components/ConnectCard";
import ApprovalCard from "../_components/ApprovalCard";
import StatTile from "../_components/StatTile";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger } from "../_components/motion";
import { IconContent, IconSparkle } from "../icons";

type Tab = "review" | "published" | "google" | "scheduled" | "writer";

const TYPE_LABEL: Record<string, string> = {
  new_blog: "Blog post",
  new_page: "Service page",
  fix_meta: "Meta rewrite",
  improve_content: "Content rewrite",
  geo_answers: "FAQ / AI answers",
};

export default function ContentPage() {
  const { brand } = usePortalAuth();
  const { data, loading } = usePlatformData(brand?.id);
  const [tab, setTab] = useState<Tab>("review");

  if (!brand) return null;

  const drafts = data?.drafts ?? [];
  const gbp = data?.gbp ?? [];
  const pending = drafts.filter((d) => d.status === "pending_review");
  const published = drafts.filter((d) => d.status === "published" || d.status === "approved");
  const pendingGbp = gbp.filter((g) => g.status === "pending_review");

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "review", label: "Needs review", count: pending.length || undefined },
    { key: "published", label: "Published", count: published.length || undefined },
    { key: "google", label: "Google Posts", count: pendingGbp.length || undefined },
    { key: "scheduled", label: "Scheduled" },
    { key: "writer", label: "AI Writer" },
  ];

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Content"
        title="Your content pipeline"
        sub="Everything your AI team has written for you — review it, approve it, and watch it go live."
      />

      <Panel>
        <Stagger className="p-stat-grid">
          <StatTile label="Awaiting review" value={pending.length || "—"} tone={pending.length ? "amber" : "muted"} />
          <StatTile label="Published" value={published.length || "—"} tone={published.length ? "green" : "muted"} />
          <StatTile label="Google posts ready" value={pendingGbp.length || "—"} tone={pendingGbp.length ? "accent" : "muted"} />
          <StatTile label="Total drafted" value={drafts.length || "—"} tone="muted" />
        </Stagger>
      </Panel>

      <SubNav items={TABS} value={tab} onChange={setTab} />

      {loading ? (
        <Stagger className="p-cardlist">
          {[...Array(3)].map((_, i) => <div key={i} className="p-skel" style={{ height: 200 }} />)}
        </Stagger>
      ) : tab === "review" ? (
        pending.length === 0 ? (
          <EmptyState icon="✓" title="Nothing waiting on you" sub="When your agents draft new content, it lands here for your approval before going live." />
        ) : (
          <Stagger className="p-cardlist">
            {pending.map((d) => <DraftCard key={d.id} draft={d} />)}
          </Stagger>
        )
      ) : tab === "published" ? (
        published.length === 0 ? (
          <EmptyState icon="📄" title="Nothing published yet" sub="Approved content appears here once it's live on your website." />
        ) : (
          <Panel>
            <PanelHead title="Published content" badge={published.length} badgeTone="green" />
            <div className="p-table-wrap">
              <table className="p-table">
                <thead><tr><th>Title</th><th>Type</th><th>Keyword</th><th>Date</th></tr></thead>
                <tbody>
                  {published.map((d) => (
                    <tr key={d.id}>
                      <td><div className="p-kwcell" title={d.title}>{cleanTitle(d.title)}</div></td>
                      <td><span className="p-chip">{TYPE_LABEL[d.task_type] || d.task_type}</span></td>
                      <td>{d.target_keyword || <span className="p-na">—</span>}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
                        {new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )
      ) : tab === "google" ? (
        pendingGbp.length === 0 ? (
          <EmptyState icon="📍" title="No Google posts waiting" sub="Google Business Profile posts drafted for you will appear here, ready to approve." />
        ) : (
          <Stagger className="p-cardlist">
            {pendingGbp.map((g) => <GbpCard key={g.id} post={g} />)}
          </Stagger>
        )
      ) : tab === "scheduled" ? (
        <Stagger className="p-subgrid">
          <ConnectCard
            icon={<IconContent size={17} />}
            title="Publish on your schedule"
            desc="Queue approved content for a set date and time and build a calendar weeks ahead, instead of everything going live the moment you approve it."
            unlocks={["Choose exactly when each piece goes live", "Plan weeks of content in advance", "Keep a steady publishing rhythm"]}
            note="Approved content currently publishes immediately."
          />
          <ConnectCard
            title="Publishing calendar"
            desc="A month-at-a-glance view of what's going live and when, across your website, Google Posts and social channels."
            unlocks={["A month-at-a-glance publishing view", "Website, Google Posts and social together"]}
          />
        </Stagger>
      ) : (
        <div className="p-stack">
          <Panel>
            <PanelHead title="AI Writer" sub="Your agents already write content automatically from your keyword opportunities." />
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "var(--surface2)", padding: 18, borderRadius: 12 }}>
              <span className="p-exec-icon" style={{ background: "var(--surface)" }}><IconSparkle size={17} /></span>
              <div>
                <p style={{ margin: "0 0 8px", fontSize: 13.5, lineHeight: 1.65 }}>
                  Every week your agents pick the highest-opportunity keywords for {brand.name},
                  write content targeting them, and drop the result into <b>Needs review</b>.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                  Want something specific written? Head to <b>Intelligence → Opportunities</b> and use
                  the one-click actions there to commission a page or rewrite on any keyword.
                </p>
              </div>
            </div>
          </Panel>
          <Stagger className="p-subgrid">
            <ConnectCard
              title="Write on demand"
              desc="Type a topic or keyword and get a full draft back in your voice, without waiting for the weekly cycle."
              unlocks={["Type a topic, get a full draft back", "Written in your established brand voice"]}
            />
            <ConnectCard
              title="Social posts"
              desc="Turn every published article into ready-to-post updates for Facebook, Instagram and LinkedIn, matched to your brand voice."
              unlocks={["Every article becomes ready-to-post updates", "Facebook, Instagram and LinkedIn"]}
            />
          </Stagger>
        </div>
      )}
    </div>
  );
}

function DraftCard({ draft }: { draft: Draft }) {
  return (
    <ApprovalCard
      kind={TYPE_LABEL[draft.task_type] || draft.task_type}
      title={cleanTitle(draft.title)}
      meta={
        <>
          {draft.target_keyword && <span>🎯 {draft.target_keyword}</span>}
          <span>{new Date(draft.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </>
      }
      body={draft.body}
      footer={draft.rationale ? <span style={{ fontSize: 12, color: "var(--muted)", maxWidth: 420 }}>{draft.rationale}</span> : null}
      onApprove={() => approveDraft(draft.id)}
      onDismiss={() => dismissDraft(draft.id)}
      approveLabel="Approve & publish"
    />
  );
}

function GbpCard({ post }: { post: GbpPost }) {
  return (
    <ApprovalCard
      kind="Google post"
      title={post.title || "Google Business Profile post"}
      meta={<span>{new Date(post.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
      body={post.body}
      footer={post.cta ? <span className="p-badge accent">{post.cta}</span> : null}
      onApprove={() => setRowStatus("gbp_posts", post.id, "approved")}
      onDismiss={() => setRowStatus("gbp_posts", post.id, "dismissed")}
      approveLabel="Approve"
    />
  );
}

function cleanTitle(t: string) {
  return t.replace(/^(Blog|Page|New blog|New page|Audit \+ rewrite|Meta rewrite|Intent fix):\s*/i, "");
}
