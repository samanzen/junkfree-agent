"use client";
import { useState } from "react";
import Link from "next/link";
import { m } from "framer-motion";
import { authedFetch } from "@/lib/authedFetch";
import { fadeUp, EASE } from "../_components/motion";
import { IconCheck, IconChevron, IconLock, IconSparkle } from "../icons";
import type { Opportunity, OpportunityAction, Priority, Difficulty } from "./_engine";

const PRIORITY_META: Record<Priority, { label: string; tone: string }> = {
  critical: { label: "Critical", tone: "red" },
  high: { label: "High", tone: "amber" },
  medium: { label: "Medium", tone: "accent" },
  low: { label: "Low", tone: "plain" },
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy", moderate: "Moderate", hard: "Hard", unknown: "Not scored",
};

export default function OpportunityCard({ opportunity, brandId }: {
  opportunity: Opportunity;
  brandId: string;
}) {
  const o = opportunity;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const p = PRIORITY_META[o.priority];

  // Runs through the EXISTING /api/intelligence/action endpoint only.
  async function run(a: OpportunityAction) {
    if (!a.action || busy) return;
    setBusy(a.label);
    try {
      const res = await authedFetch("/api/intelligence/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: a.action, brand_id: brandId, payload: a.payload || {} }),
      });
      if (res.ok) setDone((d) => ({ ...d, [a.label]: true }));
      else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Couldn't start that task. Please try again.");
      }
    } catch {
      alert("Couldn't start that task. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <m.article className="p-opp" variants={fadeUp}>
      <button className="p-opp-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`p-badge ${p.tone}`}>{p.label}</span>
        <span className="p-opp-headmain">
          <span className="p-opp-kind">{o.kind}</span>
          <span className="p-opp-title">{o.title}</span>
        </span>
        <span className="p-opp-facts">
          <span className="p-opp-fact"><b>{DIFFICULTY_LABEL[o.difficulty]}</b>difficulty</span>
          <span className="p-opp-fact"><b>{o.effort}</b>typical effort</span>
        </span>
        <m.span className="p-opp-chev" animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.22, ease: EASE }}>
          <IconChevron size={15} />
        </m.span>
      </button>

      {o.impact.length > 0 && (
        <div className="p-opp-impact">
          {o.impact.map((i) => <span key={i} className="p-opp-chip">{i}</span>)}
        </div>
      )}

      <m.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{ overflow: "hidden" }}
      >
        <div className="p-opp-body">
          <div className="p-opp-section">
            <h4>Why this matters</h4>
            <p>{o.why}</p>
          </div>
          <div className="p-opp-section">
            <h4>Action plan</h4>
            <ul className="p-opp-steps">
              {o.steps.map((s) => <li key={s}><IconCheck size={13} /> {s}</li>)}
            </ul>
          </div>
        </div>
      </m.div>

      <div className="p-opp-actions">
        {o.actions.map((a) => {
          if (a.comingSoon) {
            return (
              <button key={a.label} className="p-btn ghost" disabled title="Not available yet">
                <IconLock size={12} /> {a.label} · Coming soon
              </button>
            );
          }
          if (a.href) {
            return (
              <Link key={a.label} href={a.href} className={`p-btn ${a.primary ? "primary" : "ghost"}`}>
                {a.label} <IconChevron size={13} />
              </Link>
            );
          }
          if (done[a.label]) {
            return (
              <span key={a.label} className="p-badge green p-opp-queued">
                <IconCheck size={12} /> Added to your queue
              </span>
            );
          }
          return (
            <m.button
              key={a.label}
              className={`p-btn ${a.primary ? "primary" : "ghost"}`}
              disabled={!!busy}
              onClick={() => run(a)}
              whileTap={{ scale: 0.97 }}
            >
              {busy === a.label ? "Starting…" : <><IconSparkle size={13} /> {a.label}</>}
            </m.button>
          );
        })}
      </div>
    </m.article>
  );
}
