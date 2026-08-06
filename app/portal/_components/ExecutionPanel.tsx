"use client";
import { useState } from "react";
import Link from "next/link";
import { m } from "framer-motion";
import { authedFetch } from "@/lib/authedFetch";
import { IconSparkle, IconCheck, IconLock, IconChevron } from "../icons";
import { useToast } from "@/app/_components/Notify";

// ── Contract ────────────────────────────────────────────────────────────────
// The shared execution surface for every opportunity, now and in future.
//
// A capability is either wired to a REAL existing endpoint or explicitly
// marked `soon` and rendered disabled. There is no third state: nothing here
// ever pretends to do something the backend can't.

/** Action types the existing /api/intelligence/action endpoint accepts. */
export type AgentAction =
  | "improve_content" | "fix_meta" | "rewrite_page"
  | "generate_faq" | "build_backlinks" | "boost_page1";

export type Capability = {
  id: string;
  label: string;
  /** What this actually produces, in the customer's language. */
  produces: string;
  primary?: boolean;
} & (
  | { exec: "agent"; action: AgentAction; payload?: Record<string, unknown> }
  | { exec: "navigate"; href: string }
  | { exec: "soon" }
);

/** A concrete row already waiting on a human decision. */
export type QueueItem = {
  id: string;
  kind: "draft" | "review" | "gbp";
  title: string;
  meta?: string;
  status: string;
};

type ItemState = "idle" | "busy" | "approved" | "published" | "dismissed";

export default function ExecutionPanel({
  brandId, capabilities = [], queue = [], queueHref, queueTotal,
}: {
  brandId: string;
  capabilities?: Capability[];
  queue?: QueueItem[];
  queueHref?: string;
  queueTotal?: number;
}) {
  const [capState, setCapState] = useState<Record<string, "idle" | "busy" | "done">>({});
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const toast = useToast();

  // Runs through the existing /api/intelligence/action endpoint.
  async function runCapability(c: Capability) {
    if (c.exec !== "agent") return;
    setCapState((s) => ({ ...s, [c.id]: "busy" }));
    try {
      const res = await authedFetch("/api/intelligence/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: c.action, brand_id: brandId, payload: c.payload || {} }),
      });
      if (res.ok) setCapState((s) => ({ ...s, [c.id]: "done" }));
      else {
        const e = await res.json().catch(() => ({}));
        toast.error("Couldn't start that", e.error || "Please try again in a moment.");
        setCapState((s) => ({ ...s, [c.id]: "idle" }));
      }
    } catch {
      toast.error("Couldn't start that", "Check your connection and try again.");
      setCapState((s) => ({ ...s, [c.id]: "idle" }));
    }
  }

  // Runs through the existing draft / platform-row endpoints.
  async function runItem(item: QueueItem, op: "approve" | "dismiss" | "publish") {
    setItemState((s) => ({ ...s, [item.id]: "busy" }));
    try {
      let res: Response;
      if (item.kind === "draft") {
        res = op === "publish"
          ? await authedFetch(`/api/drafts/${item.id}/publish`, { method: "POST" })
          : await authedFetch(`/api/drafts/${item.id}/approve${op === "dismiss" ? "?action=dismiss" : ""}`, { method: "POST" });
      } else {
        const table = item.kind === "review" ? "review_responses" : "gbp_posts";
        res = await authedFetch(`/api/platform/${table}/${item.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: op === "dismiss" ? "dismissed" : "approved" }),
        });
      }

      if (res.ok) {
        setItemState((s) => ({
          ...s,
          [item.id]: op === "dismiss" ? "dismissed" : op === "publish" ? "published" : "approved",
        }));
      } else {
        const e = await res.json().catch(() => ({}));
        toast.error("That didn't go through", e.error || "Please try again in a moment.");
        setItemState((s) => ({ ...s, [item.id]: "idle" }));
      }
    } catch {
      toast.error("That didn't go through", "Check your connection and try again.");
      setItemState((s) => ({ ...s, [item.id]: "idle" }));
    }
  }

  const hasCaps = capabilities.length > 0;
  const hasQueue = queue.length > 0;
  if (!hasCaps && !hasQueue) return null;

  return (
    <div className="p-exec-panel">
      {hasCaps && (
        <div className="p-exec-group">
          <h4 className="p-exec-grouphead"><IconSparkle size={12} /> Your AI can do this for you</h4>
          <div className="p-exec-caps">
            {capabilities.map((c) => {
              const st = capState[c.id] || "idle";

              if (c.exec === "soon") {
                return (
                  <div key={c.id} className="p-cap p-cap-soon" aria-disabled="true">
                    <div className="p-cap-main">
                      <span className="p-cap-label">{c.label}</span>
                      <span className="p-cap-produces">{c.produces}</span>
                    </div>
                    <span className="p-cap-soontag"><IconLock size={11} /> Coming soon</span>
                  </div>
                );
              }

              if (c.exec === "navigate") {
                return (
                  <Link key={c.id} href={c.href} className="p-cap p-cap-link">
                    <div className="p-cap-main">
                      <span className="p-cap-label">{c.label}</span>
                      <span className="p-cap-produces">{c.produces}</span>
                    </div>
                    <IconChevron size={14} className="p-cap-arrow" />
                  </Link>
                );
              }

              return (
                <m.button
                  key={c.id}
                  className={`p-cap p-cap-run ${st === "done" ? "is-done" : ""}`}
                  onClick={() => runCapability(c)}
                  disabled={st !== "idle"}
                  whileTap={st === "idle" ? { scale: 0.985 } : undefined}
                >
                  <div className="p-cap-main">
                    <span className="p-cap-label">{c.label}</span>
                    <span className="p-cap-produces">
                      {st === "done" ? "Queued — your agents are on it" : c.produces}
                    </span>
                  </div>
                  {st === "done"
                    ? <span className="p-cap-done"><IconCheck size={13} /></span>
                    : <span className="p-cap-go">{st === "busy" ? "…" : "Run"}</span>}
                </m.button>
              );
            })}
          </div>
        </div>
      )}

      {hasQueue && (
        <div className="p-exec-group">
          <h4 className="p-exec-grouphead">Waiting on your decision</h4>
          <div className="p-exec-queue">
            {queue.map((item) => {
              const st = itemState[item.id] || "idle";
              const settled = st === "dismissed" || st === "published";

              return (
                <div key={item.id} className="p-qitem">
                  <div className="p-qitem-main">
                    <span className="p-qitem-title">{item.title}</span>
                    {item.meta && <span className="p-qitem-meta">{item.meta}</span>}
                  </div>

                  {settled ? (
                    <span className="p-badge green p-qitem-state">
                      <IconCheck size={11} /> {st === "published" ? "Published" : "Dismissed"}
                    </span>
                  ) : st === "approved" ? (
                    <div className="p-qitem-actions">
                      <span className="p-badge green"><IconCheck size={11} /> Approved</span>
                      {item.kind === "draft" && (
                        <button className="p-btn primary p-qitem-btn" onClick={() => runItem(item, "publish")}>
                          Publish
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-qitem-actions">
                      <button className="p-btn ghost p-qitem-btn" disabled={st === "busy"} onClick={() => runItem(item, "dismiss")}>
                        Dismiss
                      </button>
                      <button className="p-btn primary p-qitem-btn" disabled={st === "busy"} onClick={() => runItem(item, "approve")}>
                        {st === "busy" ? "…" : "Approve"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {queueHref && queueTotal != null && queueTotal > queue.length && (
            <Link href={queueHref} className="p-exec-more">
              View all {queueTotal} <IconChevron size={12} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
