"use client";
import CountUp from "@/app/dashboard/CountUp";
import { IconArrowUp, IconArrowDown, IconLock } from "../icons";

// A single KPI tile. Three distinct states, never blurred together:
//  - a real value (optionally with a period-over-period delta)
//  - "—" because the source is connected but has no value yet
//  - locked, because that data source isn't wired up for this business yet
export default function MetricCard({
  label, value, delta, color = "var(--accent)", hint,
  decimals = 0, suffix = "", invert = false, locked = false, lockedHint = "Connect to unlock",
}: {
  label: string;
  value?: number | null;
  delta?: number | null;
  color?: string;
  hint?: string;
  decimals?: number;
  suffix?: string;
  invert?: boolean;
  locked?: boolean;
  lockedHint?: string;
}) {
  const up = delta != null && delta > 0;
  const good = invert ? !up : up;

  return (
    <div className="p-kpi">
      <div className="p-kpi-top">
        <span className="p-kpi-icon" style={{ background: color, opacity: 0.16 }} />
        <span className="p-kpi-label">{label}</span>
      </div>

      {locked ? (
        <>
          <div className="p-kpi-na">—</div>
          <div className="p-kpi-bottom">
            <span className="p-kpi-hint" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconLock size={11} /> {lockedHint}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="p-kpi-val" style={{ color }}>
            <CountUp value={value ?? null} decimals={decimals} suffix={suffix} />
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
    </div>
  );
}
