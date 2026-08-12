"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Outcome-focused reporting showcase. Charts are illustrative samples of the
 * intelligence surface — competitive share, demand you can win, leaks costing
 * leads — not claimed customer metrics. Motion is intentional: draw-in, live
 * pulse, and count-up when the section enters view.
 */

const C = {
  cyan: "#29ABE2",
  blue: "#0E6FA6",
  navy: "#12212F",
  sky: "#7DD3FC",
  orange: "#F7941E",
  gold: "#F5C542",
  teal: "#0D9B8A",
  coral: "#FF8A65",
  soft: "#D7E0EA",
};

function useInView<T extends HTMLElement>(once = true) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) io.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.22 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);
  return { ref, visible };
}

function useCountUp(target: number, active: boolean, ms = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, ms]);
  return n;
}

function Donut({
  segments,
  size = 148,
  thickness = 22,
  center,
  sub,
  active,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
  center: string;
  sub?: string;
  active: boolean;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className={`mkc-donut${active ? " is-on" : ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.soft} strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * c;
          const el = (
            <circle
              key={seg.label}
              className="mkc-donut-seg"
              style={{ animationDelay: `${i * 120}ms` }}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="mkc-donut-center">
        <strong>{center}</strong>
        {sub ? <span>{sub}</span> : null}
      </div>
    </div>
  );
}

function Gauge({ value, label, active }: { value: number; label: string; active: boolean }) {
  const clamped = Math.max(0, Math.min(100, value));
  const shown = useCountUp(clamped, active);
  const r = 54;
  const c = Math.PI * r;
  const filled = (clamped / 100) * c;
  return (
    <div className={`mkc-gauge${active ? " is-on" : ""}`}>
      <svg width="148" height="92" viewBox="0 0 148 92" aria-hidden="true">
        <defs>
          <linearGradient id="mkcGauge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C.teal} />
            <stop offset="55%" stopColor={C.cyan} />
            <stop offset="100%" stopColor={C.orange} />
          </linearGradient>
        </defs>
        <path
          d="M20 78 A54 54 0 0 1 128 78"
          fill="none"
          stroke={C.soft}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M20 78 A54 54 0 0 1 128 78"
          fill="none"
          stroke="url(#mkcGauge)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          className="mkc-gauge-arc"
        />
      </svg>
      <div className="mkc-gauge-readout">
        <strong>{shown}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function AreaChart({ active }: { active: boolean }) {
  const you =
    "M0,98 C28,92 40,70 56,66 C78,60 90,78 112,62 C134,46 148,38 170,42 C198,48 210,28 236,22 C252,18 268,26 280,20 L280,120 L0,120 Z";
  const youLine =
    "M0,98 C28,92 40,70 56,66 C78,60 90,78 112,62 C134,46 148,38 170,42 C198,48 210,28 236,22 C252,18 268,26 280,20";
  const rival =
    "M0,108 C36,104 52,96 72,94 C100,90 118,100 140,88 C168,74 190,70 214,72 C240,74 258,66 280,58 L280,120 L0,120 Z";
  const rivalLine =
    "M0,108 C36,104 52,96 72,94 C100,90 118,100 140,88 C168,74 190,70 214,72 C240,74 258,66 280,58";
  const pts = [0, 56, 112, 170, 236, 280];
  const ys = [98, 66, 62, 42, 22, 20];
  return (
    <svg
      className={`mkc-area${active ? " is-on" : ""}`}
      viewBox="0 0 280 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mkcYou" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.cyan} stopOpacity="0.48" />
          <stop offset="100%" stopColor={C.cyan} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="mkcRival" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.orange} stopOpacity="0.36" />
          <stop offset="100%" stopColor={C.orange} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={rival} fill="url(#mkcRival)" className="mkc-area-fill" />
      <path d={you} fill="url(#mkcYou)" className="mkc-area-fill mkc-area-fill-you" />
      <path d={rivalLine} fill="none" stroke={C.orange} strokeWidth="2.5" className="mkc-area-line" />
      <path d={youLine} fill="none" stroke={C.blue} strokeWidth="2.5" className="mkc-area-line mkc-area-line-you" />
      {pts.map((x, i) => (
        <circle
          key={x}
          className="mkc-area-dot"
          style={{ animationDelay: `${0.55 + i * 0.08}s` }}
          cx={x}
          cy={ys[i]}
          r="3.4"
          fill={C.blue}
          stroke="#fff"
          strokeWidth="1.5"
        />
      ))}
      <line className="mkc-scan" x1="0" y1="0" x2="0" y2="120" stroke={C.cyan} strokeWidth="1.5" opacity="0.35" />
    </svg>
  );
}

function Bars({ active }: { active: boolean }) {
  const rows = [
    { label: "High-intent local", value: 92, color: C.teal },
    { label: "Competitor content gaps", value: 84, color: C.orange },
    { label: "Service / money pages", value: 76, color: C.cyan },
    { label: "Authority opportunities", value: 61, color: C.blue },
    { label: "Technical quick wins", value: 48, color: C.gold },
  ];
  return (
    <ul className={`mkc-bars${active ? " is-on" : ""}`} aria-label="Sample opportunity scores by business impact">
      {rows.map((row, i) => (
        <li key={row.label} style={{ animationDelay: `${i * 80}ms` }}>
          <div className="mkc-bars-meta">
            <span>{row.label}</span>
            <b>{row.value}</b>
          </div>
          <div className="mkc-bars-track">
            <span
              className="mkc-bars-fill"
              style={{
                width: active ? `${row.value}%` : "0%",
                background: row.color,
                transitionDelay: `${i * 80}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Timeline({ active }: { active: boolean }) {
  const steps = [
    { n: "1", title: "Map rivals", color: C.cyan },
    { n: "2", title: "Score impact", color: C.blue },
    { n: "3", title: "Approve", color: C.orange },
    { n: "4", title: "Ship work", color: C.gold },
    { n: "5", title: "Prove lift", color: C.teal },
  ];
  return (
    <ol className={`mkc-timeline${active ? " is-on" : ""}`} aria-label="Intelligence loop">
      {steps.map((s, i) => (
        <li key={s.title} style={{ animationDelay: `${i * 90}ms` }}>
          <span className="mkc-timeline-node" style={{ background: s.color }}>
            {s.n}
          </span>
          <span className="mkc-timeline-label">{s.title}</span>
          {i < steps.length - 1 ? <span className="mkc-timeline-line" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}

function Columns({ active }: { active: boolean }) {
  const cols = [
    { h: 42, color: C.sky },
    { h: 58, color: C.cyan },
    { h: 48, color: C.blue },
    { h: 72, color: C.teal },
    { h: 64, color: C.orange },
    { h: 88, color: C.gold },
    { h: 76, color: C.coral },
    { h: 94, color: C.teal },
  ];
  return (
    <div className={`mkc-cols${active ? " is-on" : ""}`} aria-hidden="true">
      {cols.map((c, i) => (
        <span
          key={i}
          className="mkc-col"
          style={{
            height: active ? `${c.h}%` : "8%",
            background: c.color,
            transitionDelay: `${i * 55}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function MarketingCharts() {
  const { ref, visible } = useInView<HTMLElement>();
  const openIssues = useCountUp(42, visible);

  return (
    <section
      ref={ref}
      className={`mk-section mkc${visible ? " is-on" : ""}`}
      aria-labelledby="mk-charts-title"
    >
      <div className="mk-wrap">
        <div className="mk-section-head">
          <p className="mk-eyebrow">Business intelligence</p>
          <h2 id="mk-charts-title" className="mk-h2">
            See where you are losing — and what will grow the business next
          </h2>
          <p className="mk-lead">
            Competitive share, demand you can still win, and fixes ranked by impact on leads
            and revenue — so you decide with evidence, not hunches.
          </p>
        </div>

        <div className="mkc-board" role="img" aria-label="Sample competitive and growth intelligence charts">
          <article className="mkc-panel mkc-panel-gauge">
            <header>
              <h3>Growth readiness</h3>
              <p>How ready the site is to win demand</p>
            </header>
            <Gauge value={78} label="Ready to scale" active={visible} />
            <ul className="mkc-legend">
              <li><i style={{ background: C.teal }} /> Technical</li>
              <li><i style={{ background: C.cyan }} /> Content</li>
              <li><i style={{ background: C.orange }} /> Authority</li>
            </ul>
          </article>

          <article className="mkc-panel mkc-panel-area">
            <header>
              <h3>You vs competitors</h3>
              <p>Visibility trend · illustrative</p>
            </header>
            <div className="mkc-area-wrap">
              <AreaChart active={visible} />
            </div>
            <ul className="mkc-legend">
              <li><i style={{ background: C.blue }} /> Your brand</li>
              <li><i style={{ background: C.orange }} /> Top rivals</li>
            </ul>
          </article>

          <article className="mkc-panel mkc-panel-donut">
            <header>
              <h3>Leaks costing you leads</h3>
              <p>Ranked by business risk</p>
            </header>
            <div className="mkc-donut-row">
              <Donut
                active={visible}
                center={String(openIssues)}
                sub="to fix"
                segments={[
                  { value: 14, color: C.orange, label: "Critical" },
                  { value: 11, color: C.gold, label: "High" },
                  { value: 9, color: C.cyan, label: "Medium" },
                  { value: 8, color: C.teal, label: "Low" },
                ]}
              />
              <ul className="mkc-legend mkc-legend-stack">
                <li><i style={{ background: C.orange }} /> Critical 14</li>
                <li><i style={{ background: C.gold }} /> High 11</li>
                <li><i style={{ background: C.cyan }} /> Medium 9</li>
                <li><i style={{ background: C.teal }} /> Low 8</li>
              </ul>
            </div>
          </article>

          <article className="mkc-panel mkc-panel-bars">
            <header>
              <h3>Demand you can win</h3>
              <p>Scored by revenue / lead impact</p>
            </header>
            <Bars active={visible} />
          </article>

          <article className="mkc-panel mkc-panel-cols">
            <header>
              <h3>Pipeline from search</h3>
              <p>Pages gaining commercial intent</p>
            </header>
            <Columns active={visible} />
            <ul className="mkc-legend">
              <li><i style={{ background: C.cyan }} /> Climbing</li>
              <li><i style={{ background: C.orange }} /> New wins</li>
              <li><i style={{ background: C.teal }} /> Recovered</li>
            </ul>
          </article>

          <article className="mkc-panel mkc-panel-loop">
            <header>
              <h3>Always-on intelligence loop</h3>
              <p>Compare → prioritize → ship → prove</p>
            </header>
            <Timeline active={visible} />
          </article>
        </div>

        <p className="mkc-note">
          Illustrative sample of the intelligence surface — not a live customer report.
        </p>
      </div>
    </section>
  );
}
