"use client";
import { useState, type ReactNode } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import {
  usePlatformData, approveDraft, dismissDraft, setRowStatus,
  type Draft, type GbpPost,
} from "../_data";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import EmptyState from "../_components/EmptyState";
import ConnectCard from "../_components/ConnectCard";
import StatTile from "../_components/StatTile";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger, fadeUp, EASE } from "../_components/motion";
import { IconContent, IconSparkle, IconCheck } from "../icons";
import ResponsiveTable from "@/app/_components/ResponsiveTable";
import WorkPreview, { type WorkPreviewModel } from "@/app/_components/WorkPreview";
import { uniqueByTopic, factsKey } from "@/lib/recommendations/topic";
import DecisionReport from "@/app/_components/DecisionReport";
import { decisionWhy, displayWorkTitle, plannedPageUrl, type DecisionWhyInput, type KeywordFacts } from "@/lib/recommendations/preview";
import { useToast } from "@/app/_components/Notify";
import Field from "@/app/_components/Field";
import { authedFetch } from "@/lib/authedFetch";
import { m } from "framer-motion";

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
  const keywordFacts = data?.keywordFacts ?? {};
  const pending = uniqueByTopic(drafts.filter((d) => d.status === "pending_review"));
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
            {pending.map((d) => <DraftCard key={d.id} draft={d} brandName={brand.name} siteUrl={brand.site_url} facts={keywordFacts[factsKey(brand.id, d.target_keyword || "")]} />)}
          </Stagger>
        )
      ) : tab === "published" ? (
        published.length === 0 ? (
          <EmptyState icon="📄" title="Nothing published yet" sub="Approved content appears here once it's live on your website." />
        ) : (
          <Panel>
            <PanelHead title="Published content" badge={published.length} badgeTone="green" />
            <ResponsiveTable>
              <table className="p-table">
                <thead><tr><th>Title</th><th>Type</th><th>Keyword</th><th>Date</th></tr></thead>
                <tbody>
                  {published.map((d) => (
                    <tr key={d.id}>
                      <td><div className="p-kwcell" title={d.title}>{displayWorkTitle(d.title)}</div></td>
                      <td><span className="p-chip">{TYPE_LABEL[d.task_type] || d.task_type}</span></td>
                      <td>{d.target_keyword || <span className="p-na">—</span>}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
                        {new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          </Panel>
        )
      ) : tab === "google" ? (
        pendingGbp.length === 0 ? (
          <EmptyState icon="📍" title="No Google posts waiting" sub="Google Business Profile posts drafted for you will appear here, ready to approve." />
        ) : (
          <Stagger className="p-cardlist">
            {pendingGbp.map((g) => <GbpCard key={g.id} post={g} brandName={brand.name} siteUrl={brand.site_url} />)}
          </Stagger>
        )
      ) : tab === "scheduled" ? (
        <Stagger className="p-subgrid">
          <ConnectCard
            icon={<IconContent size={17} />}
            title="Publish on your schedule"
            desc="Queue approved content for a set date and time and build a calendar weeks ahead, instead of everything going live the moment you approve it."
            unlocks={["Choose exactly when each piece goes live", "Plan weeks of content in advance", "Keep a steady publishing rhythm"]}
            requirement="Approved content currently publishes immediately."
          />
          <ConnectCard
            title="Publishing calendar"
            desc="A month-at-a-glance view of what's going live and when, across your website, Google Posts and social channels."
            unlocks={["A month-at-a-glance publishing view", "Website, Google Posts and social together"]}
            requirement="Needs scheduled publishing. Approved work is published on demand today, so there are no future-dated items to place on a calendar."
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
              requirement="Content is planned by your agents from ranking opportunities. Requesting a specific piece needs a request queue the platform doesn't have yet."
            />
            <ConnectCard
              title="Social posts"
              desc="Turn every published article into ready-to-post updates for Facebook, Instagram and LinkedIn, matched to your brand voice."
              unlocks={["Every article becomes ready-to-post updates", "Facebook, Instagram and LinkedIn"]}
              requirement="Needs a connection to each social network to publish to. No social integrations exist yet."
            />
          </Stagger>
        </div>
      )}
    </div>
  );
}

function DraftCard({ draft, brandName, siteUrl, facts }: {
  draft: Draft; brandName: string; siteUrl: string; facts?: KeywordFacts;
}) {
  const href = plannedPageUrl({
    taskType: draft.task_type,
    title: draft.title,
    targetUrl: draft.target_url,
    targetKeyword: draft.target_keyword,
    siteUrl,
  });
  const whyInput: DecisionWhyInput = {
    kind: "draft",
    taskType: draft.task_type,
    title: draft.title,
    keyword: draft.target_keyword,
    url: draft.target_url || href,
    rationale: draft.rationale,
    body: draft.body,
    facts: facts || null,
  };
  return (
    <PreviewPlanCard
      kind={TYPE_LABEL[draft.task_type] || draft.task_type}
      title={displayWorkTitle(draft.title)}
      href={href}
      why={decisionWhy(whyInput)}
      whyInput={whyInput}
      meta={
        <>
          {draft.target_keyword && <span>🎯 {draft.target_keyword}</span>}
          <span>{new Date(draft.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </>
      }
      work={{
        title: draft.title,
        body: draft.body,
        taskType: draft.task_type,
        targetUrl: draft.target_url,
        targetKeyword: draft.target_keyword,
        rationale: draft.rationale,
        plannedUrl: href,
        facts: facts || null,
      }}
      brandName={brandName}
      siteUrl={siteUrl}
      approveLabel="Approve & publish"
      onApprove={() => approveDraft(draft.id)}
      onDismiss={() => dismissDraft(draft.id)}
      onFeedback={async (text) => {
        const res = await authedFetch(`/api/drafts/${draft.id}/revise`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: text }),
        });
        return res.ok;
      }}
    />
  );
}

function GbpCard({ post, brandName, siteUrl }: { post: GbpPost; brandName: string; siteUrl: string }) {
  const whyInput: DecisionWhyInput = { kind: "google_post", title: post.title, body: post.body };
  return (
    <PreviewPlanCard
      kind="Google post"
      title={post.title || "Google Business Profile post"}
      why={decisionWhy(whyInput)}
      whyInput={whyInput}
      meta={<span>{new Date(post.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
      work={{ title: post.title || "Google post", body: post.body, taskType: "google_post", cta: post.cta || "" }}
      brandName={brandName}
      siteUrl={siteUrl}
      approveLabel="Approve"
      onApprove={() => setRowStatus("gbp_posts", post.id, "approved")}
      onDismiss={() => setRowStatus("gbp_posts", post.id, "dismissed")}
    />
  );
}

function PreviewPlanCard({
  kind, title, href, why, whyInput, meta, work, brandName, siteUrl, approveLabel, onApprove, onDismiss, onFeedback,
}: {
  kind: string;
  title: string;
  href?: string | null;
  why?: string | null;
  whyInput?: DecisionWhyInput | null;
  meta?: ReactNode;
  work: WorkPreviewModel;
  brandName: string;
  siteUrl: string;
  approveLabel: string;
  onApprove: () => Promise<boolean>;
  onDismiss: () => Promise<boolean>;
  onFeedback?: (text: string) => Promise<boolean>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"" | "approved" | "dismissed">("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  async function run(which: "approve" | "dismiss") {
    setBusy(true);
    const ok = await (which === "approve" ? onApprove : onDismiss)();
    setBusy(false);
    if (ok) {
      setDone(which === "approve" ? "approved" : "dismissed");
      setOpen(false);
    } else {
      toast.error("That didn't go through", "Please try again in a moment.");
    }
  }

  async function sendFeedback() {
    if (!onFeedback || !feedbackText.trim()) return;
    setBusy(true);
    const ok = await onFeedback(feedbackText.trim());
    setBusy(false);
    if (ok) {
      toast.success("Draft revised", "The agent has rewritten it with your feedback.");
      setFeedbackText("");
      setFeedbackOpen(false);
    } else {
      toast.error("That didn't go through", "Please try again in a moment.");
    }
  }

  if (done) {
    return (
      <m.div
        className="p-approve p-approve-done"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: EASE }}
      >
        <span className={`p-badge ${done === "approved" ? "green" : ""}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          {done === "approved" && <IconCheck size={12} />}
          {done === "approved" ? "Approved" : "Dismissed"}
        </span>
        <span className="p-approve-donetitle">{title}</span>
      </m.div>
    );
  }

  return (
    <>
      <m.article className="p-approve" variants={fadeUp}>
        <div className="p-approve-head">
          <div style={{ minWidth: 0 }}>
            <span className="p-chip">{kind}</span>
            <h3 className="p-approve-title">{title}</h3>
            {href && (
              <a className="p-approve-url" href={href} target="_blank" rel="noreferrer">{href}</a>
            )}
            {meta && <div className="p-approve-meta">{meta}</div>}
          </div>
        </div>
        {whyOpen && why && (
          <div className="p-approve-why">
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{why}</p>
            {whyInput && (
              <button type="button" className="p-btn ghost" style={{ marginTop: 10 }} onClick={() => setReportOpen(true)}>
                Full report
              </button>
            )}
          </div>
        )}
        {feedbackOpen && onFeedback && (
          <div style={{ display: "flex", gap: 8, margin: "8px 0 4px", alignItems: "flex-end" }}>
            <Field
              hideLabel
              label="Feedback for the agent"
              value={feedbackText}
              disabled={busy}
              onChange={(e) => setFeedbackText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void sendFeedback(); }}
              placeholder="Tell the agent what to change…"
            />
            <button type="button" className="p-btn primary" disabled={busy} onClick={() => void sendFeedback()}>
              {busy ? "…" : "Send"}
            </button>
          </div>
        )}
        <div className="p-approve-foot">
          <div className="p-approve-actions">
            <m.button type="button" className="p-btn primary" onClick={() => setOpen(true)} whileTap={{ scale: 0.97 }}>
              Preview
            </m.button>
            <m.button type="button" className="p-btn primary" disabled={busy} onClick={() => void run("approve")} whileTap={{ scale: 0.97 }}>
              {busy ? "…" : approveLabel.startsWith("Approve") ? "Approve" : approveLabel}
            </m.button>
            {onFeedback && (
              <m.button type="button" className="p-btn ghost" onClick={() => { setFeedbackOpen((v) => !v); setWhyOpen(false); }} whileTap={{ scale: 0.97 }}>
                Feedback
              </m.button>
            )}
            {why && (
              <m.button type="button" className="p-btn ghost" onClick={() => { setWhyOpen((v) => !v); setFeedbackOpen(false); }} whileTap={{ scale: 0.97 }}>
                Why
              </m.button>
            )}
            {whyInput && (
              <m.button type="button" className="p-btn ghost" onClick={() => setReportOpen(true)} whileTap={{ scale: 0.97 }}>
                More
              </m.button>
            )}
          </div>
        </div>
      </m.article>
      <WorkPreview
        open={open}
        onClose={() => setOpen(false)}
        brandName={brandName}
        siteUrl={siteUrl}
        work={work}
        approveLabel={approveLabel}
        busy={busy}
        onApprove={() => { void run("approve"); }}
        onDecline={() => { void run("dismiss"); }}
        feedback={onFeedback ? {
          value: feedbackText,
          onChange: setFeedbackText,
          onSend: () => { void sendFeedback(); },
          sending: busy,
        } : undefined}
      />
      <DecisionReport open={reportOpen} onClose={() => setReportOpen(false)} input={whyInput || null} />
    </>
  );
}
