"use client";
import { m } from "framer-motion";
import type { ReactNode } from "react";
import { EASE } from "./motion";

// Honest empty state — used wherever a data source is connected but has
// nothing to show yet. Never used to disguise fabricated data.
export default function EmptyState({ icon = "○", title, sub, action }: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <m.div
      className="p-empty"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.42, ease: EASE }}
    >
      <div className="p-empty-icon">{icon}</div>
      <div className="p-empty-title">{title}</div>
      {sub && <p className="p-empty-sub">{sub}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </m.div>
  );
}
