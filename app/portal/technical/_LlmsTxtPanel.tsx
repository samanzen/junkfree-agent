"use client";
import { useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { useToast } from "@/app/_components/Notify";
import { Panel, PanelHead } from "../_components/Panel";
import { IconContent, IconCheck } from "../icons";

// Customer-facing surface for lib/geo-agent.ts's buildLlmsTxt(), which had no
// caller before Phase 8A.
//
// Fetched with authedFetch rather than linked to directly: the portal
// authenticates with a bearer token held in localStorage, so a plain <a> to
// the route would arrive without an Authorization header and be rejected by
// requireAuth. Fetching also means the content can be shown and copied in
// place, which is what the customer actually needs to do with it.
export default function LlmsTxtPanel({ brandId }: { brandId: string }) {
  const toast = useToast();
  const [content, setContent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const res = await authedFetch(`/api/portal/llms-txt?brand=${brandId}`);
      if (!res.ok) {
        toast.error("Couldn't generate your llms.txt", "Please try again in a moment.");
        return;
      }
      setContent(await res.text());
    } catch {
      toast.error("Couldn't generate your llms.txt", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied", "Save it as llms.txt in the root of your website.");
    } catch {
      toast.error("Couldn't copy", "Select the text and copy it manually.");
    }
  }

  return (
    <Panel>
      <PanelHead
        title="llms.txt for AI assistants"
        sub="A machine-readable facts sheet so ChatGPT, Gemini and Google's AI Overviews describe your business accurately instead of guessing. Save it at the root of your site as /llms.txt."
      />

      {content === null ? (
        <button className="p-btn primary" onClick={load} disabled={busy} data-busy={busy || undefined}>
          <span><IconContent size={15} /> Generate my llms.txt</span>
        </button>
      ) : (
        <div className="p-stack">
          <pre className="p-approve-body" style={{ maxHeight: 320, overflow: "auto" }}>{content}</pre>
          <div className="p-toolbar">
            <button className="p-btn primary" onClick={copy}>
              <span><IconCheck size={15} /> Copy to clipboard</span>
            </button>
            <button className="p-btn ghost" onClick={load} disabled={busy} data-busy={busy || undefined}>
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
