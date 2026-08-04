"use client";
import { m } from "framer-motion";
import ScoreRing from "./ScoreRing";
import AnimatedNumber from "./AnimatedNumber";
import { EASE } from "./motion";

export type MissionStat = {
  label: string;
  value: number | null;
  decimals?: number;
  suffix?: string;
  delta?: number | null;
  invert?: boolean;
};

function verdict(score: number | null) {
  if (score == null) return { text: "Awaiting data", color: "var(--muted)", bg: "var(--surface3)" };
  if (score >= 80) return { text: "Excellent", color: "var(--green)", bg: "var(--green-soft)" };
  if (score >= 60) return { text: "On track", color: "var(--accent)", bg: "var(--accent-soft)" };
  if (score >= 40) return { text: "Needs attention", color: "var(--amber)", bg: "var(--amber-soft)" };
  return { text: "Action required", color: "var(--red)", bg: "var(--red-soft)" };
}

// The Mission Control hero: greeting, business name, live health score and a
// telemetry strip of the headline numbers. Presentation only — every value is
// passed in by the page from data it already had.
export default function MissionHero({
  greeting, title, subtitle, score, stats,
}: {
  greeting: string;
  title: string;
  subtitle: string;
  score: number | null;
  stats: MissionStat[];
}) {
  const v = verdict(score);

  return (
    <m.section
      className="p-mission"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <div className="p-mission-top">
        <div style={{ minWidth: 0 }}>
          <div className="p-mission-greet">
            {greeting}
            <span className="p-mission-live"><i />Live</span>
          </div>
          <h1 className="p-mission-title">{title}</h1>
          <p className="p-mission-sub">{subtitle}</p>
        </div>

        <m.div
          className="p-mission-ring"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
        >
          <ScoreRing value={score} size={148} strokeWidth={11} label="Business Health" gradient big />
          <span className="p-mission-verdict" style={{ color: v.color, background: v.bg }}>{v.text}</span>
        </m.div>
      </div>

      <div className="p-mission-strip">
        {stats.map((s, i) => {
          const up = s.delta != null && s.delta > 0;
          const good = s.invert ? !up : up;
          return (
            <m.div
              key={s.label}
              className="p-mission-cell"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.28 + i * 0.06 }}
            >
              <div className="p-mission-cell-label">{s.label}</div>
              <div className="p-mission-cell-val">
                <span style={{ color: s.value == null ? "var(--muted2)" : "var(--text)" }}>
                  <AnimatedNumber value={s.value} decimals={s.decimals ?? 0} suffix={s.suffix ?? ""} />
                </span>
                {s.delta != null && s.delta !== 0 && (
                  <span className={`p-kpi-delta ${good ? "good" : "bad"}`}>
                    {up ? "▲" : "▼"} {Math.abs(s.delta).toLocaleString(undefined, { maximumFractionDigits: s.decimals ?? 0 })}
                  </span>
                )}
              </div>
            </m.div>
          );
        })}
      </div>
    </m.section>
  );
}
