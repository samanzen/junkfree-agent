"use client";
import { useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { useToast, useConfirm } from "@/app/_components/Notify";
import { Panel, PanelHead } from "./Panel";
import { IconAlert, IconLink } from "../icons";

/**
 * Persistent post-certify checklist: add a nav/footer link to /{namespace}/.
 * Dismiss requires an explicit warning — proxied pages orphan without the link.
 */
export default function ProxyNavNudgeCard({
  brandId,
  namespace,
  onDismissed,
}: {
  brandId: string;
  namespace: string;
  onDismissed?: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const path = `/${namespace}/`;

  async function dismiss() {
    const ok = await confirm({
      title: "Dismiss without adding a link?",
      body: `Pages under ${path} can stay orphaned without a nav or footer link. Dismiss only if you've already added one.`,
      confirmLabel: "Dismiss anyway",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await authedFetch("/api/proxy/nav-nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "We couldn't dismiss that");
        return;
      }
      toast.success("Dismissed", "You can still add the link later.");
      onDismissed?.();
    } catch {
      toast.error("We couldn't dismiss that", "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHead
        title="Link your new pages"
        sub="One checklist item after proving publishing."
      />
      <div className="p-conn-note" style={{ margin: "0 16px 16px" }}>
        <IconAlert size={13} />
        <span>
          Add one link to <code>{path}</code> from your site navigation or footer.
          Without it, new pages stay hard for visitors and search engines to find.
        </span>
      </div>
      <div className="p-conn-actions" style={{ padding: "0 16px 16px" }}>
        <a className="p-btn ghost" href="/portal/settings">
          <IconLink size={13} />
          <span>Open Connections</span>
        </a>
        <button type="button" className="p-btn ghost" onClick={() => void dismiss()} disabled={busy}>
          <span>{busy ? "Dismissing…" : "Dismiss"}</span>
        </button>
      </div>
    </Panel>
  );
}
