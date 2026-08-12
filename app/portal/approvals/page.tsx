"use client";
import { usePortalAuth } from "@/lib/portalAuth";
import {
  usePlatformData, approveDraft, dismissDraft, setRowStatus,
  type Draft, type ReviewResponse,
} from "../_data";
import PageHeader from "../_components/PageHeader";
import EmptyState from "../_components/EmptyState";
import ApprovalCard from "../_components/ApprovalCard";
import StatTile from "../_components/StatTile";
import { Panel } from "../_components/Panel";
import { Stagger } from "../_components/motion";

const TYPE_LABEL: Record<string, string> = {
  new_blog: "Blog post",
  new_page: "Service page",
  fix_meta: "Meta rewrite",
  improve_content: "Content rewrite",
  geo_answers: "FAQ / AI answers",
};

type InboxItem =
  | { kind: "draft"; at: string; draft: Draft }
  | { kind: "review"; at: string; review: ReviewResponse };

export default function ApprovalsPage() {
  const { brand } = usePortalAuth();
  const { data, loading, error } = usePlatformData(brand?.id);

  if (!brand) return null;

  const pendingDrafts = (data?.drafts ?? []).filter((d) => d.status === "pending_review");
  const pendingReviews = (data?.reviews ?? []).filter((r) => r.status === "pending_review");

  const inbox: InboxItem[] = [
    ...pendingDrafts.map((draft): InboxItem => ({ kind: "draft", at: draft.created_at, draft })),
    ...pendingReviews.map((review): InboxItem => ({ kind: "review", at: review.created_at, review })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Approvals"
        title="Waiting on you"
        sub="Content drafts and review replies ready for your yes — approve them here and they go live."
      />

      <Panel>
        <Stagger className="p-stat-grid">
          <StatTile
            label="Total waiting"
            value={loading ? "—" : inbox.length || "—"}
            tone={inbox.length ? "amber" : "muted"}
          />
          <StatTile
            label="Content drafts"
            value={loading ? "—" : pendingDrafts.length || "—"}
            tone={pendingDrafts.length ? "accent" : "muted"}
          />
          <StatTile
            label="Review replies"
            value={loading ? "—" : pendingReviews.length || "—"}
            tone={pendingReviews.length ? "pink" : "muted"}
          />
        </Stagger>
      </Panel>

      {loading ? (
        <Stagger className="p-cardlist">
          {[...Array(3)].map((_, i) => <div key={i} className="p-skel" style={{ height: 200 }} />)}
        </Stagger>
      ) : error ? (
        <EmptyState
          icon="!"
          title="Couldn't load your approvals"
          sub={error}
          action={
            <button className="p-btn ghost" onClick={() => window.location.reload()}>
              Try again
            </button>
          }
        />
      ) : inbox.length === 0 ? (
        <EmptyState
          icon="✓"
          title="You're all caught up"
          sub="When your AI team drafts content or a review reply, it lands here for your approval before anything goes live."
        />
      ) : (
        <Stagger className="p-cardlist">
          {inbox.map((item) =>
            item.kind === "draft"
              ? <DraftCard key={item.draft.id} draft={item.draft} />
              : <ReviewCard key={item.review.id} review={item.review} />,
          )}
        </Stagger>
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
          {draft.target_keyword && <span>{draft.target_keyword}</span>}
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

function ReviewCard({ review }: { review: ReviewResponse }) {
  return (
    <ApprovalCard
      kind={`${review.rating ?? "—"}★ review`}
      title={review.reviewer_name || "Anonymous reviewer"}
      meta={
        <>
          <Stars rating={review.rating} />
          <span>{new Date(review.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </>
      }
      preface={
        review.review_text
          ? <blockquote className="p-review-quote">&ldquo;{review.review_text}&rdquo;</blockquote>
          : null
      }
      bodyLabel="Your drafted reply"
      body={review.draft_response}
      onApprove={() => setRowStatus("review_responses", review.id, "approved")}
      onDismiss={() => setRowStatus("review_responses", review.id, "dismissed")}
      approveLabel="Approve reply"
    />
  );
}

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="p-na">—</span>;
  return <span className="p-stars">{"★".repeat(rating)}{"☆".repeat(Math.max(0, 5 - rating))}</span>;
}

function cleanTitle(t: string) {
  return t.replace(/^(Blog|Page|New blog|New page|Audit \+ rewrite|Meta rewrite|Intent fix):\s*/i, "");
}
