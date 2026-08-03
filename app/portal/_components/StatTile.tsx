"use client";
import { m } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp } from "./motion";

// Compact stat used in dense grids (Intelligence overview, Local SEO, Website).
export default function StatTile({ label, value, tone = "accent", sub }: {
  label: string;
  value: ReactNode;
  tone?: "accent" | "green" | "amber" | "red" | "blue" | "pink" | "muted";
  sub?: string;
}) {
  const color = tone === "muted" ? "var(--muted2)" : `var(--${tone})`;
  return (
    <m.div className="p-stattile" variants={fadeUp}>
      <div className="p-stattile-val" style={{ color }}>{value}</div>
      <div className="p-stattile-label">{label}</div>
      {sub && <div className="p-stattile-sub">{sub}</div>}
    </m.div>
  );
}
