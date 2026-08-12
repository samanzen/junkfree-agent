"use client";
import { m } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp } from "./motion";

// Standard content panel used across every portal page. Reveals with a
// fade-up; when rendered inside <Stagger> it inherits the parent's timing.
// No entrance animation.
//
// This used to fade+rise every panel on mount. Two problems, both real:
//
//  1. The dashboard read as EMPTY for the first couple of seconds — the worst
//     possible first impression for a product whose whole claim is that it is
//     data-rich and always working.
//  2. Framer drives animation with requestAnimationFrame, which is PAUSED in a
//     background tab. Anything whose visibility depends on an entrance
//     animation therefore stays at opacity:0 indefinitely if the page loads
//     while the tab is not focused — measured directly: visibilityState
//     "hidden", hasFocus false, rAF never fires, every panel stuck at 0.
//
// Content is now present at first paint. Motion is reserved for CHANGE —
// values counting, rows arriving, state transitions — never for arrival.
export function Panel({ children, className = "", style }: {
  children: ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <section className={`p-panel ${className}`} style={style}>
      {children}
    </section>
  );
}

export function PanelHead({ title, badge, badgeTone = "accent", action, sub }: {
  title: string;
  badge?: ReactNode;
  badgeTone?: "accent" | "green" | "amber" | "red" | "plain";
  action?: ReactNode;
  sub?: string;
}) {
  return (
    <>
      <div className="p-panel-head">
        <h2 className="p-panel-title">
          {title}
          {badge != null && (
            <span className={`p-badge ${badgeTone === "plain" ? "" : badgeTone}`}>{badge}</span>
          )}
        </h2>
        {action}
      </div>
      {sub && <p className="p-panel-sub">{sub}</p>}
    </>
  );
}
