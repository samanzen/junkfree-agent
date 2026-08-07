"use client";
import { useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import { usePlatformData, setRowStatus, type ReviewResponse } from "../_data";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import EmptyState from "../_components/EmptyState";
import ConnectCard from "../_components/ConnectCard";
import ApprovalCard from "../_components/ApprovalCard";
import StatTile from "../_components/StatTile";
import ScoreRing from "../_components/ScoreRing";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger } from "../_components/motion";
import { IconReviews } from "../icons";
import ResponsiveTable from "@/app/_components/ResponsiveTable";

type Tab = "pending" | "all" | "insights";

export default function ReviewsPage() {
  const { brand } = usePortalAuth();
  const { data, loading } = usePlatformData(brand?.id);
  const [tab, setTab] = useState<Tab>("pending");

  if (!brand) return null;

  const reviews = data?.reviews ?? [];
  const pending = reviews.filter((r) => r.status === "pending_review");
  const rated = reviews.filter((r) => typeof r.rating === "number");
  const avg = rated.length ? rated.reduce((s, r) => s + (r.rating as number), 0) / rated.length : null;
  const positive = rated.filter((r) => (r.rating as number) >= 4).length;
  const negative = rated.filter((r) => (r.rating as number) <= 2).length;
  // Rating is 1-5; express as a 0-100 ring so it reads like the other scores.
  const ratingScore = avg != null ? Math.round((avg / 5) * 100) : null;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "pending", label: "Needs a reply", count: pending.length || undefined },
    { key: "all", label: "All reviews", count: reviews.length || undefined },
    { key: "insights", label: "Insights" },
  ];

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Reviews"
        title="What customers are saying"
        sub="Replies are drafted for you automatically — responding to every review is a real local ranking signal."
      />

      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <ScoreRing value={ratingScore} size={92} strokeWidth={9} />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              {avg != null ? `${avg.toFixed(1)} average` : "No ratings yet"}
            </div>
          </div>
          <Stagger className="p-stat-grid" style={{ flex: 1, minWidth: 260 }}>
            <StatTile label="Total reviews" value={reviews.length || "—"} tone={reviews.length ? "pink" : "muted"} />
            <StatTile label="Awaiting reply" value={pending.length || "—"} tone={pending.length ? "amber" : "muted"} />
            <StatTile label="Positive (4-5★)" value={positive || "—"} tone={positive ? "green" : "muted"} />
            <StatTile label="Negative (1-2★)" value={negative || "—"} tone={negative ? "red" : "muted"} />
          </Stagger>
        </div>
      </Panel>

      <SubNav items={TABS} value={tab} onChange={setTab} />

      {loading ? (
        <Stagger className="p-cardlist">
          {[...Array(3)].map((_, i) => <div key={i} className="p-skel" style={{ height: 180 }} />)}
        </Stagger>
      ) : tab === "pending" ? (
        pending.length === 0 ? (
          <EmptyState
            icon="✓"
            title="Every review has been handled"
            sub="When a new review comes in, we'll draft a reply and put it here for you to approve."
          />
        ) : (
          <Stagger className="p-cardlist">
            {pending.map((r) => <ReviewCard key={r.id} review={r} />)}
          </Stagger>
        )
      ) : tab === "all" ? (
        reviews.length === 0 ? (
          <EmptyState
            icon="⭐"
            title="No reviews collected yet"
            sub="Once your review sources are connected, every review and its drafted reply appears here."
          />
        ) : (
          <Panel>
            <PanelHead title="All reviews" badge={reviews.length} />
            <ResponsiveTable>
              <table className="p-table">
                <thead><tr><th>Reviewer</th><th>Rating</th><th>Review</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.reviewer_name || "Anonymous"}</b></td>
                      <td><Stars rating={r.rating} /></td>
                      <td style={{ maxWidth: 360, color: "var(--muted)", fontSize: 12.5 }}>
                        {r.review_text ? truncate(r.review_text, 120) : <span className="p-na">—</span>}
                      </td>
                      <td>
                        <span className={`p-badge ${r.status === "pending_review" ? "amber" : "green"}`}>
                          {r.status === "pending_review" ? "Needs reply" : r.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
                        {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          </Panel>
        )
      ) : (
        <Stagger className="p-subgrid">
          <ConnectCard
            icon={<IconReviews size={17} />}
            title="Never miss a review again"
            desc="New reviews arrive the moment they're posted, from Google, Facebook and the directories that matter in your industry — with a reply already drafted."
            unlocks={["Reviews pulled in automatically", "A reply drafted before you've even read it", "Negative reviews flagged first"]}
            requirement="Requires Google Business Profile to be connected."
          />
          <ConnectCard
            title="Review growth tracking"
            desc="Track how many new reviews you gain each month and how your average rating trends against local competitors."
            unlocks={["New reviews per month at a glance", "Your rating trend vs local competitors"]}
            requirement="Needs review history over time, which requires a Google Business Profile connection to collect reviews. That integration doesn't exist yet."
          />
          <ConnectCard
            title="Review requests"
            desc="Send review invitations to happy customers by SMS or email, and see which campaigns actually convert."
            unlocks={["Invite happy customers by SMS or email", "See which campaigns actually convert"]}
            requirement="Needs a Business Profile connection plus a way to message customers. Neither exists yet."
          />
          <ConnectCard
            title="Sentiment themes"
            desc="Groups what customers praise and complain about most, so you know what to fix and what to promote."
            unlocks={["What customers praise most", "What to fix, ranked by how often it comes up"]}
            requirement="Needs a body of collected reviews to analyse, which can't be gathered until a Business Profile connection exists."
          />
        </Stagger>
      )}
    </div>
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

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}
