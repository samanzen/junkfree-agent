"use client";
import type { ReactNode } from "react";
import { m } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";
import Sparkline from "./Sparkline";
import { fadeUp, EASE } from "./motion";
import { IconArrowUp, IconArrowDown, IconLock } from "../icons";

// A single KPI tile. Three distinct states, never blurred together:
//  - a real value (optionally with a period-over-period delta)
//  - "—" because the source is connected but has no value yet
//  - locked, because that data source isn't wired up for this business yet
export default function MetricCard({
  label, value, delta, tone = "accent", icon, hint, series,
  decimals = 0, suffix = "", invert = false, locked = false, lockedHint = "Connect to unlock",
}: {
  label: string;
  value?: number | null;
  delta?: number | null;
  /** Colour family for the icon chip and hover glow. */
  tone?: "accent" | "green" | "amber" | "red" | "blue" | "pink";
  icon?: ReactNode;
  hint?: string;
  /** Real historical series for this metric. Omit when none exists. */
  series?: number[];
  decimals?: number;
  suffix?: string;
  invert?: boolean;
  locked?: boolean;
  lockedHint?: string;
}) {
  const up = delta != null && delta > 0;
  const good = invert ? !up : up;
  const color = locked ? "var(--muted2)" : `var(--${tone})`;
  const soft = locked ? "var(--surface2)" : `var(--${tone}-soft)`;

  return (
    <m.div
      className="p-kpi"
      style={{
        ["--kpi-color" as string]: color,
        ["--kpi-soft" as string]: soft,
        ["--kpi-tint" as string]: locked ? "transparent" : `var(--${tone}-soft)`,
      }}
      variants={fadeUp}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: EASE } }}
    >
      {locked && <span className="p-kpi-lock"><IconLock size={12} /></span>}

      <div className="p-kpi-top">
        {icon && <span className="p-kpi-ico">{icon}</span>}
        <span className="p-kpi-label">{label}</span>
      </div>

      {locked ? (
        <>
          <div className="p-kpi-na">—</div>
          <div className="p-kpi-bottom">
            <span className="p-kpi-hint">{lockedHint}</span>
          </div>
        </>
      ) : (
        <>
          <div className="p-kpi-mid">
            <div className="p-kpi-val" style={{ color: value == null ? "var(--muted2)" : "var(--text)" }}>
              <AnimatedNumber value={value ?? null} decimals={decimals} suffix={suffix} />
            </div>
            {series && series.length > 1 && (
              <span className="p-kpi-spark"><Sparkline data={series} color={color} /></span>
            )}
          </div>
          <div className="p-kpi-bottom">
            {delta != null && delta !== 0 && (
              <span className={`p-kpi-delta ${good ? "good" : "bad"}`}>
                {up ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}
                {Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: decimals })}
              </span>
            )}
            {hint && <span className="p-kpi-hint">{hint}</span>}
          </div>
        </>
      )}
    </m.div>
  );
}
