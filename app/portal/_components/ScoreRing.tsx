"use client";
import { useId } from "react";
import { m, useReducedMotion } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";
import { EASE } from "./motion";

// Circular score gauge (0-100) with an animated arc draw. Renders a neutral
// "—" ring when the value is null rather than fabricating a number, so
// "not connected yet" stays visually distinct from "scored zero".
export default function ScoreRing({
  value, size = 72, strokeWidth = 7, label, big, gradient,
}: {
  value: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  big?: boolean;
  /** Use the brand gradient for the arc (hero-scale rings). */
  gradient?: boolean;
}) {
  const reduce = useReducedMotion();
  const gid = useId().replace(/:/g, "");
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference - (pct / 100) * circumference;
  const flat =
    value == null ? "var(--muted2)" :
    value >= 80 ? "var(--green)" :
    value >= 60 ? "var(--accent)" :
    value >= 40 ? "var(--amber)" : "var(--red)";
  const below =
    value == null ? "var(--muted2)" :
    value >= 80 ? "var(--series-3)" :
    value >= 60 ? "var(--series-1)" :
    value >= 40 ? "var(--series-4)" : "var(--series-2)";
  const stroke = gradient && value != null ? `url(#ring-${gid})` : flat;

  return (
    <div className="p-ring-wrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* The sweep runs from the band BELOW this score to the band itself, so
            the ring reads as "arrived here" rather than as decoration. Stops
            are real palette values; --accent2/3 are mesh washes and would have
            rendered this nearly invisible. */}
        {gradient && (
          <defs>
            <linearGradient id={`ring-${gid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={below} />
              <stop offset="100%" stopColor={flat} />
            </linearGradient>
          </defs>
        )}
        <circle className="p-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth} />
        {value != null && (
          <m.circle
            className="p-ring-val"
            cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth}
            stroke={stroke}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: reduce ? offset : circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: reduce ? 0 : 1.25, ease: EASE, delay: reduce ? 0 : 0.15 }}
          />
        )}
      </svg>
      <div className="p-ring-num">
        <b style={{ color: value == null ? "var(--muted2)" : "var(--text)", fontSize: big ? Math.round(size * 0.29) : Math.round(size * 0.28) }}>
          {value == null ? "—" : <AnimatedNumber value={value} />}
        </b>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}
