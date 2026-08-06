"use client";
import { useState } from "react";
import { m } from "framer-motion";
import ExecutionPanel from "../_components/ExecutionPanel";
import { fadeUp, EASE } from "../_components/motion";
import { IconCheck, IconChevron } from "../icons";
import type { Opportunity, Priority, Difficulty } from "./_engine";

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
  const p = PRIORITY_META[o.priority];

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
        <m.span className="p-opp-chev" animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18, ease: EASE }}>
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
        transition={{ duration: 0.28, ease: EASE }}
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

        <ExecutionPanel
          brandId={brandId}
          capabilities={o.capabilities}
          queue={o.queue}
          queueHref={o.queueHref}
          queueTotal={o.queueTotal}
        />
      </m.div>

      {!open && (
        <button className="p-opp-expand" onClick={() => setOpen(true)}>
          Show the plan and run it <IconChevron size={13} />
        </button>
      )}
    </m.article>
  );
}
