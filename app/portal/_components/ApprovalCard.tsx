"use client";
import { useState, type ReactNode } from "react";

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
  onApprove?: () => Promise<boolean>;
  onDismiss?: () => Promise<boolean>;
  approveLabel?: string;
  dismissLabel?: string;
  collapsedHeight?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<"" | "approve" | "dismiss">("");
  const [done, setDone] = useState<"" | "approved" | "dismissed">("");

  async function run(which: "approve" | "dismiss") {
    const fn = which === "approve" ? onApprove : onDismiss;
    if (!fn) return;
    setBusy(which);
    const ok = await fn();
    setBusy("");
    if (ok) setDone(which === "approve" ? "approved" : "dismissed");
    else alert("That didn't go through. Please try again.");
  }

  if (done) {
    return (
      <div className="p-approve p-approve-done">
        <span className={`p-badge ${done === "approved" ? "green" : ""}`}>
          {done === "approved" ? "✓ Approved" : "Dismissed"}
        </span>
        <span className="p-approve-donetitle">{title}</span>
      </div>
    );
  }

  const longBody = !!body && body.length > 400;

  return (
    <article className="p-approve">
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
          <div
            className="p-approve-body"
            style={{ maxHeight: expanded ? "none" : collapsedHeight, overflow: expanded ? "visible" : "hidden" }}
          >
            {body}
          </div>
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
            <button className="p-btn ghost" disabled={!!busy} onClick={() => run("dismiss")}>
              {busy === "dismiss" ? "…" : dismissLabel}
            </button>
          )}
          {onApprove && (
            <button className="p-btn primary" disabled={!!busy} onClick={() => run("approve")}>
              {busy === "approve" ? "Publishing…" : approveLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
