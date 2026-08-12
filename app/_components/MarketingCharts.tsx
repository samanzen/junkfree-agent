"use client";

/**
 * Marketing “reporting” showcase — colorful product-style charts inspired by
 * modern SEO analytics kits (cyan / navy / orange / teal / gold on light ground).
 *
 * Values are illustrative samples of the *kind* of reporting the product shows,
 * not claimed customer results.
 */

const C = {
  cyan: "#29ABE2",
  blue: "#0E6FA6",
  navy: "#12212F",
  sky: "#7DD3FC",
  orange: "#F7941E",
  gold: "#F5C542",
  teal: "#0D9B8A",
  mint: "#5EEAD4",
  coral: "#FF8A65",
  soft: "#D7E0EA",
  ink: "#1B2C3F",
  muted: "#556B82",
};

function Donut({
  segments,
  size = 148,
  thickness = 22,
  center,
  sub,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
  center: string;
  sub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="mkc-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={C.soft}
          strokeWidth={thickness}
        />
        {segments.map((seg) => {
          const len = (seg.value / total) * c;
          const el = (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
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

function Gauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 54;
  const c = Math.PI * r;
  const filled = (clamped / 100) * c;
  return (
    <div className="mkc-gauge">
      <svg width="148" height="92" viewBox="0 0 148 92" aria-hidden="true">
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
        <defs>
          <linearGradient id="mkcGauge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C.teal} />
            <stop offset="55%" stopColor={C.cyan} />
            <stop offset="100%" stopColor={C.orange} />
          </linearGradient>
        </defs>
      </svg>
      <div className="mkc-gauge-readout">
        <strong>{clamped}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function AreaChart() {
  // Sample organic vs referral traffic curves (viewBox 0..280 x 0..120)
  const organic =
    "M0,98 C28,92 40,70 56,66 C78,60 90,78 112,62 C134,46 148,38 170,42 C198,48 210,28 236,22 C252,18 268,26 280,20 L280,120 L0,120 Z";
  const organicLine =
    "M0,98 C28,92 40,70 56,66 C78,60 90,78 112,62 C134,46 148,38 170,42 C198,48 210,28 236,22 C252,18 268,26 280,20";
  const referral =
    "M0,108 C36,104 52,96 72,94 C100,90 118,100 140,88 C168,74 190,70 214,72 C240,74 258,66 280,58 L280,120 L0,120 Z";
  const referralLine =
    "M0,108 C36,104 52,96 72,94 C100,90 118,100 140,88 C168,74 190,70 214,72 C240,74 258,66 280,58";
  return (
    <svg className="mkc-area" viewBox="0 0 280 120" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="mkcOrg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.cyan} stopOpacity="0.45" />
          <stop offset="100%" stopColor={C.cyan} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="mkcRef" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.orange} stopOpacity="0.38" />
          <stop offset="100%" stopColor={C.orange} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={referral} fill="url(#mkcRef)" className="mkc-area-fill" />
      <path d={organic} fill="url(#mkcOrg)" className="mkc-area-fill" />
      <path d={referralLine} fill="none" stroke={C.orange} strokeWidth="2.5" className="mkc-area-line" />
      <path d={organicLine} fill="none" stroke={C.blue} strokeWidth="2.5" className="mkc-area-line" />
      {[0, 56, 112, 170, 236, 280].map((x, i) => (
        <circle key={x} cx={x} cy={[98, 66, 62, 42, 22, 20][i]} r="3.2" fill={C.blue} stroke="#fff" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function Bars() {
  const rows = [
    { label: "Local intent", value: 92, color: C.teal },
    { label: "Service pages", value: 78, color: C.cyan },
    { label: "Blog / guides", value: 64, color: C.blue },
    { label: "Competitor gaps", value: 51, color: C.orange },
    { label: "Long-tail", value: 38, color: C.gold },
  ];
  return (
    <ul className="mkc-bars" aria-label="Sample keyword opportunity scores">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mkc-bars-meta">
            <span>{row.label}</span>
            <b>{row.value}</b>
          </div>
          <div className="mkc-bars-track">
            <span
              className="mkc-bars-fill"
              style={{ width: `${row.value}%`, background: row.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Timeline() {
  const steps = [
    { n: "1", title: "Connect", color: C.cyan },
    { n: "2", title: "Analyze", color: C.blue },
    { n: "3", title: "Approve", color: C.orange },
    { n: "4", title: "Publish", color: C.gold },
    { n: "5", title: "Measure", color: C.teal },
  ];
  return (
    <ol className="mkc-timeline" aria-label="Operating loop">
      {steps.map((s, i) => (
        <li key={s.title}>
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

function Columns() {
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
    <div className="mkc-cols" aria-hidden="true">
      {cols.map((c, i) => (
        <span
          key={i}
          className="mkc-col"
          style={{ height: `${c.h}%`, background: c.color, animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

export default function MarketingCharts() {
  return (
    <section className="mk-section mkc" aria-labelledby="mk-charts-title">
      <div className="mk-wrap">
        <div className="mk-section-head">
          <p className="mk-eyebrow">Reporting</p>
          <h2 id="mk-charts-title" className="mk-h2">
            Colorful charts that show what moved
          </h2>
          <p className="mk-lead">
            Health scores, traffic mix, keyword opportunities, and issue breakdowns —
            so you can see progress without another spreadsheet.
          </p>
        </div>

        <div className="mkc-board" role="img" aria-label="Sample SEO reporting charts">
          <article className="mkc-panel mkc-panel-gauge">
            <header>
              <h3>SEO health</h3>
              <p>Composite site score</p>
            </header>
            <Gauge value={78} label="Healthy" />
            <ul className="mkc-legend">
              <li><i style={{ background: C.teal }} /> Technical</li>
              <li><i style={{ background: C.cyan }} /> Content</li>
              <li><i style={{ background: C.orange }} /> Authority</li>
            </ul>
          </article>

          <article className="mkc-panel mkc-panel-area">
            <header>
              <h3>Traffic trend</h3>
              <p>Organic vs referral · sample</p>
            </header>
            <div className="mkc-area-wrap">
              <AreaChart />
            </div>
            <ul className="mkc-legend">
              <li><i style={{ background: C.blue }} /> Organic</li>
              <li><i style={{ background: C.orange }} /> Referral</li>
            </ul>
          </article>

          <article className="mkc-panel mkc-panel-donut">
            <header>
              <h3>Issues by type</h3>
              <p>Prioritized backlog</p>
            </header>
            <div className="mkc-donut-row">
              <Donut
                center="42"
                sub="open"
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
              <h3>Keyword opportunities</h3>
              <p>Score by cluster · sample</p>
            </header>
            <Bars />
          </article>

          <article className="mkc-panel mkc-panel-cols">
            <header>
              <h3>Weekly visibility</h3>
              <p>Indexed pages gaining impressions</p>
            </header>
            <Columns />
            <ul className="mkc-legend">
              <li><i style={{ background: C.cyan }} /> Up</li>
              <li><i style={{ background: C.orange }} /> New</li>
              <li><i style={{ background: C.teal }} /> Recovered</li>
            </ul>
          </article>

          <article className="mkc-panel mkc-panel-loop">
            <header>
              <h3>Operating loop</h3>
              <p>Always on, always measurable</p>
            </header>
            <Timeline />
          </article>
        </div>

        <p className="mkc-note">
          Charts above are illustrative samples of the reporting surface — not live customer metrics.
        </p>
      </div>
    </section>
  );
}
