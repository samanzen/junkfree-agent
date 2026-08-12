"use client";
import { useState, type ReactNode } from "react";
import { m } from "framer-motion";
import { fadeUp, EASE } from "./motion";
import { IconCheck } from "../icons";
import { useToast } from "@/app/_components/Notify";

export type ApprovalActionResult = boolean | { ok: boolean; detail?: string | null };

// Card for anything awaiting the customer's yes/no: a content draft, a Google
// post, a drafted review reply. Body is rendered as plain text (never HTML)
// so drafted content can't inject markup.
export default function ApprovalCard({
  kind, title, meta, preface, body, bodyLabel, footer, onApprove, onDismiss,
  approveLabel = "Approve", dismissLabel = "Dismiss", collapsedHeight = 150,
}: {
  kind?: string;
  title: string;
  meta?: ReactNode;
  /** Custom content rendered above the body (e.g. the original review). */
  preface?: ReactNode;
  body?: string | null;
  /** Small label above the body block. */
  bodyLabel?: string;
  footer?: ReactNode;
  onApprove?: () => Promise<ApprovalActionResult>;
  onDismiss?: () => Promise<ApprovalActionResult>;
  approveLabel?: string;
  dismissLabel?: string;
  collapsedHeight?: number;
}) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<"" | "approve" | "dismiss">("");
  const [done, setDone] = useState<"" | "approved" | "dismissed">("");
  const [doneDetail, setDoneDetail] = useState<string | null>(null);

  async function run(which: "approve" | "dismiss") {
    const fn = which === "approve" ? onApprove : onDismiss;
    if (!fn) return;
    setBusy(which);
    const result = await fn();
    setBusy("");
    const ok = typeof result === "boolean" ? result : result.ok;
    const detail = typeof result === "boolean" ? null : result.detail || null;
    if (ok) {
      setDone(which === "approve" ? "approved" : "dismissed");
      setDoneDetail(detail);
      if (detail && which === "approve") {
        if (/connect wordpress|not configured|workspace/i.test(detail)) {
          toast.info("Approved", detail);
        } else if (/fail|error|couldn/i.test(detail)) {
          toast.error("Approved, but live publish needs attention", detail);
        } else {
          toast.success("Approved", detail);
        }
      }
    } else {
      toast.error("That didn't go through", "Please try again in a moment.");
    }
  }

  if (done) {
    const badgeClass = done === "approved" ? "p-badge green" : "p-badge";
    return (
      <m.div
        className="p-approve p-approve-done"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: EASE }}
      >
        <span className={badgeClass} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          {done === "approved" ? <IconCheck size={12} /> : null}
          {done === "approved" ? "Approved" : "Dismissed"}
        </span>
        <span className="p-approve-donetitle">{title}</span>
        {doneDetail ? <span className="p-approve-donedetail">{doneDetail}</span> : null}
      </m.div>
    );
  }

  const longBody = !!body && body.length > 400;

  return (
    <m.article className="p-approve" variants={fadeUp}>
      <div className="p-approve-head">
        <div style={{ minWidth: 0 }}>
          {kind && <span className="p-chip">{kind.replace(/_/g, " ")}</span>}
          <h3 className="p-approve-title">{title}</h3>
          {meta && <div className="p-approve-meta">{meta}</div>}
        </div>
      </div>

      {preface}

      {body && (
        <>
          {bodyLabel && <div className="p-reply-label">{bodyLabel}</div>}
          <m.div
            className="p-approve-body"
            initial={false}
            animate={{ height: expanded || !longBody ? "auto" : collapsedHeight }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            {body}
          </m.div>
        </>
      )}
      {longBody && (
        <button className="p-approve-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      <div className="p-approve-foot">
        {footer}
        <div className="p-approve-actions">
          {onDismiss && (
            <m.button className="p-btn ghost" disabled={!!busy} onClick={() => run("dismiss")}
              whileTap={{ scale: 0.97 }}>
              {busy === "dismiss" ? "…" : dismissLabel}
            </m.button>
          )}
          {onApprove && (
            <m.button className="p-btn primary" disabled={!!busy} onClick={() => run("approve")}
              whileTap={{ scale: 0.97 }}>
              {busy === "approve" ? "Publishing…" : approveLabel}
            </m.button>
          )}
        </div>
      </div>
    </m.article>
  );
}
