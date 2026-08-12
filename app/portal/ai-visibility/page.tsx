"use client";
import { useCallback, useEffect, useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import { authedFetch } from "@/lib/authedFetch";
import PageHeader from "../_components/PageHeader";
import EmptyState from "../_components/EmptyState";
import StatTile from "../_components/StatTile";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger } from "../_components/motion";
import Field from "@/app/_components/Field";
import { useToast } from "@/app/_components/Notify";
import { IconSparkle } from "../icons";

type Check = {
  id?: string;
  prompt: string;
  engine: string;
  mentioned: boolean;
  captured_at: string;
};

export default function AiVisibilityPage() {
  const { brand } = usePortalAuth();
  const toast = useToast();
  const [score, setScore] = useState<number | null>(null);
  const [quota, setQuota] = useState(25);
  const [prompts, setPrompts] = useState<{ id: string; prompt: string }[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");

  const load = useCallback(async () => {
    if (!brand?.id) return;
    setLoading(true);
    try {
      const d = await (await authedFetch(`/api/portal/ai-visibility?brand=${brand.id}`)).json();
      setScore(typeof d.score === "number" ? d.score : null);
      setQuota(d.quota || 25);
      setPrompts(d.prompts || []);
      setChecks(d.checks || []);
    } finally {
      setLoading(false);
    }
  }, [brand?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPrompt() {
    if (!brand?.id || !newPrompt.trim()) return;
    setBusy(true);
    try {
      const res = await authedFetch("/api/portal/ai-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brand.id, action: "add_prompt", prompt: newPrompt }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error("Couldn't add prompt", d.error || "Try again.");
        return;
      }
      setNewPrompt("");
      setPrompts(d.prompts || []);
      toast.success("Prompt added", "We'll check it on the next visibility run.");
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    if (!brand?.id) return;
    setBusy(true);
    try {
      const res = await authedFetch("/api/portal/ai-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brand.id, action: "run_check" }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error("Check failed", d.error || "Try again in a moment.");
        return;
      }
      setScore(d.score);
      if (Array.isArray(d.checks)) setChecks(d.checks);
      toast.success("Visibility updated", `Mention share is now ${d.score}%.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!brand) return null;

  const mentioned = checks.filter((c) => c.mentioned).length;
  const missed = checks.filter((c) => !c.mentioned).length;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="AI Visibility"
        title="Are AI assistants recommending you?"
        sub="We ask real discovery questions the way ChatGPT-style assistants do — and track whether your brand is mentioned. This is execution-grade GEO, not a static report."
      />

      <Panel>
        <Stagger className="p-stat-grid">
          <StatTile
            label="Mention share"
            value={score == null ? "—" : `${score}%`}
            tone={score == null ? "muted" : score >= 50 ? "green" : score >= 20 ? "amber" : "red"}
          />
          <StatTile label="Prompts tracked" value={prompts.length || "—"} tone="blue" />
          <StatTile label="Mentions (recent)" value={mentioned || "—"} tone={mentioned ? "green" : "muted"} />
          <StatTile label="Misses (recent)" value={missed || "—"} tone={missed ? "amber" : "muted"} />
        </Stagger>
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="p-btn primary" type="button" onClick={runNow} disabled={busy} data-busy={busy || undefined}>
            <span>{busy ? "Checking…" : "Check visibility now"}</span>
          </button>
          <span style={{ fontSize: 13, color: "var(--muted)", alignSelf: "center" }}>
            Plan capacity: up to {quota} prompts
          </span>
        </div>
      </Panel>

      <Panel>
        <PanelHead
          title="Prompts you track"
          sub="Add the questions customers ask AI. We check them on performance runs and on demand."
        />
        <div className="p-toolbar" style={{ marginBottom: 12 }}>
          <Field
            hideLabel
            label="New prompt"
            className="p-toolbar-grow"
            inputClassName="p-input"
            placeholder="best junk removal in Vancouver"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addPrompt();
            }}
          />
          <button className="p-btn" type="button" onClick={addPrompt} disabled={busy || !newPrompt.trim()}>
            Add prompt
          </button>
        </div>
        {loading ? (
          <div className="p-skel" style={{ height: 80 }} />
        ) : prompts.length === 0 ? (
          <EmptyState
            icon={<IconSparkle size={22} />}
            title="Using smart defaults"
            sub="We'll start with discovery queries built from your services and area. Add custom prompts to match how your customers ask."
          />
        ) : (
          <ul className="p-feed">
            {prompts.map((p) => (
              <li key={p.id} className="p-feed-item">
                <span className="p-feed-icon" style={{ background: "var(--system-soft)", color: "var(--system)" }}>
                  <IconSparkle size={13} />
                </span>
                <div className="p-feed-title">{p.prompt}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHead title="Recent checks" sub="Each row is a real assistant-style answer we evaluated." />
        {loading ? (
          <div className="p-skel" style={{ height: 120 }} />
        ) : checks.length === 0 ? (
          <EmptyState
            icon={<IconSparkle size={22} />}
            title="No checks yet"
            sub="Run a visibility check or wait for the next performance snapshot."
          />
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>Prompt</th>
                  <th>Result</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {checks.slice(0, 30).map((c, i) => (
                  <tr key={c.id || `${c.prompt}-${i}`}>
                    <td>{c.prompt}</td>
                    <td>
                      <span className={`p-chip ${c.mentioned ? "good" : "warn"}`}>
                        {c.mentioned ? "Mentioned" : "Not mentioned"}
                      </span>
                    </td>
                    <td>
                      {c.captured_at
                        ? new Date(c.captured_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
