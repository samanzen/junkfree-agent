"use client";
import Link from "next/link";
import { m } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";
import { EASE } from "./motion";
import { IconSparkle, IconChevron } from "../icons";

export type Signal = {
  /** The number that leads the statement. */
  count: number;
  /** Sentence completing the count, e.g. "keywords within reach of page 1". */
  label: string;
  tone: "accent" | "green" | "amber" | "blue" | "pink";
  href?: string;
};

export type TopOpportunity = {
  keyword: string;
  position: number;
  impressions: number;
} | null;

// The AI intelligence band. Every figure is passed in from data the page has
// already loaded — this component derives nothing and invents nothing.
export default function AiBriefing({
  signals, topOpportunity, summarySlot,
}: {
  signals: Signal[];
  topOpportunity: TopOpportunity;
  /** The existing AI executive summary component. */
  summarySlot?: React.ReactNode;
}) {
  return (
    <m.section
      className="p-ai"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.06 }}
    >
      <div className="p-ai-head">
        <span className="p-ai-mark"><IconSparkle size={17} /></span>
        <div>
          <div className="p-ai-eyebrow">Intelligence</div>
          <h2 className="p-ai-title">What your AI team found</h2>
        </div>
      </div>

      {signals.length > 0 && (
        <div className="p-ai-signals">
          {signals.map((s, i) => {
            const inner = (
              <>
                <span className="p-ai-count" style={{ color: `var(--${s.tone})` }}>
                  <AnimatedNumber value={s.count} />
                </span>
                <span className="p-ai-label">{s.label}</span>
                {s.href && <IconChevron size={13} className="p-ai-arrow" />}
              </>
            );
            return (
              <m.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, ease: EASE, delay: 0.16 + i * 0.07 }}
              >
                {s.href
                  ? <Link href={s.href} className="p-ai-signal p-ai-signal-link">{inner}</Link>
                  : <div className="p-ai-signal">{inner}</div>}
              </m.div>
            );
          })}
        </div>
      )}

      {topOpportunity && (
        <m.div
          className="p-ai-opp"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: EASE, delay: 0.34 }}
        >
          <div className="p-ai-opp-tag">Biggest opportunity right now</div>
          <div className="p-ai-opp-body">
            <div className="p-ai-opp-kw">&ldquo;{topOpportunity.keyword}&rdquo;</div>
            <div className="p-ai-opp-meta">
              Currently position <b>{topOpportunity.position}</b> ·{" "}
              <b>{topOpportunity.impressions.toLocaleString()}</b> people saw it last month
            </div>
          </div>
          <Link href="/portal/intelligence" className="p-btn primary p-ai-opp-cta">
            See the plan <IconChevron size={13} />
          </Link>
        </m.div>
      )}

      {summarySlot}
    </m.section>
  );
}
