"use client";
import Link from "next/link";
import { m } from "framer-motion";
import ScoreRing from "./ScoreRing";
import AnimatedNumber from "./AnimatedNumber";
import { EASE } from "./motion";
import { IconChevron } from "../icons";

export type MissionStat = {
  label: string;
  value: number | null;
  decimals?: number;
  suffix?: string;
  delta?: number | null;
  invert?: boolean;
};

export type QuickAction = {
  label: string;
  count?: number;
  href: string;
  tone?: "accent" | "amber" | "green" | "pink";
};

function verdict(score: number | null) {
  if (score == null) return { text: "Awaiting data", color: "var(--muted)", bg: "var(--surface3)" };
  if (score >= 80) return { text: "Excellent", color: "var(--green)", bg: "var(--green-soft)" };
  if (score >= 60) return { text: "On track", color: "var(--accent)", bg: "var(--accent-soft)" };
  if (score >= 40) return { text: "Needs attention", color: "var(--amber)", bg: "var(--amber-soft)" };
  return { text: "Action required", color: "var(--red)", bg: "var(--red-soft)" };
}

// Mission Control hero: greeting, business name, live health score, quick
// actions and a telemetry strip. Presentation only — every value and every
// link target is supplied by the page from data it already holds.
export default function MissionHero({
  greeting, title, subtitle, score, stats, actions = [],
}: {
  greeting: string;
  title: string;
  subtitle: string;
  score: number | null;
  stats: MissionStat[];
  actions?: QuickAction[];
}) {
  const v = verdict(score);

  return (
    <m.section
      className="p-mission"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE }}
    >
      <div className="p-mission-aurora" aria-hidden="true" />

      <div className="p-mission-top">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="p-mission-greet">
            {greeting}
            <span className="p-mission-live"><i />Live</span>
          </div>
          <h1 className="p-mission-title">{title}</h1>
          <p className="p-mission-sub">{subtitle}</p>

          {actions.length > 0 && (
            <div className="p-mission-actions">
              {actions.map((a, i) => (
                <m.div
                  key={a.href + a.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, ease: EASE, delay: 0.3 + i * 0.06 }}
                >
                  <Link href={a.href} className="p-quick">
                    {a.count != null && (
                      <span className="p-quick-count" style={{ color: `var(--${a.tone || "accent"})`, background: `var(--${a.tone || "accent"}-soft)` }}>
                        {a.count}
                      </span>
                    )}
                    {a.label}
                    <IconChevron size={12} className="p-quick-arrow" />
                  </Link>
                </m.div>
              ))}
            </div>
          )}
        </div>

        <m.div
          className="p-mission-ring"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.42, ease: EASE, delay: 0.12 }}
        >
          <ScoreRing value={score} size={156} strokeWidth={12} label="Business Health" gradient big />
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
              transition={{ duration: 0.42, ease: EASE, delay: 0.34 + i * 0.06 }}
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
