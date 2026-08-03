"use client";
import type { ReactNode } from "react";

// Honest empty state — used wherever a data source is connected but has
// nothing to show yet. Never used to disguise fabricated data.
export default function EmptyState({ icon = "○", title, sub, action }: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="p-empty">
      <div className="p-empty-icon">{icon}</div>
      <div className="p-empty-title">{title}</div>
      {sub && <p className="p-empty-sub">{sub}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
