"use client";
import type { ReactNode } from "react";

// Standard content panel used across every portal page.
export function Panel({ children, className = "", style }: {
  children: ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return <section className={`p-panel ${className}`} style={style}>{children}</section>;
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
