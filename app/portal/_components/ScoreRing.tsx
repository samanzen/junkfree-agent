"use client";
import { m, useReducedMotion } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";
import { EASE } from "./motion";

// Circular score gauge (0-100) with an animated arc draw. Renders a neutral
// "—" ring when the value is null rather than fabricating a number, so
// "not connected yet" stays visually distinct from "scored zero".
export default function ScoreRing({
  value, size = 72, strokeWidth = 7, label, big,
}: {
  value: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  big?: boolean;
}) {
  const reduce = useReducedMotion();
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference - (pct / 100) * circumference;
  const color =
    value == null ? "var(--muted2)" :
    value >= 80 ? "var(--green)" :
    value >= 60 ? "var(--accent)" :
    value >= 40 ? "var(--amber)" : "var(--red)";

  return (
    <div className="p-ring-wrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="p-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth} />
        {value != null && (
          <m.circle
            className="p-ring-val"
            cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth}
            stroke={color}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: reduce ? offset : circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: reduce ? 0 : 1.1, ease: EASE, delay: reduce ? 0 : 0.12 }}
          />
        )}
      </svg>
      <div className="p-ring-num">
        <b style={{ color: value == null ? "var(--muted2)" : "var(--text)", fontSize: big ? 30 : Math.round(size * 0.28) }}>
          {value == null ? "—" : <AnimatedNumber value={value} />}
        </b>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}
