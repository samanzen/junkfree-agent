"use client";

/**
 * Ubersuggest-style rank movement:
 *   muted old  →(orange)  bold new   ▲ +3 (green) / ▼ −3 (red)
 */

function fmtPos(n: number): string {
  return String(Math.round(n));
}

function fmtDelta(n: number): number {
  return Math.max(1, Math.round(Math.abs(n)));
}

type Props = {
  previous?: number | null;
  current?: number | null;
  change?: number | null;
  direction?: "up" | "down";
  /** Small label above the numbers — Ubersuggest uses "Desktop Ranking". */
  label?: string;
  className?: string;
};

export default function RankChange({
  previous,
  current,
  change,
  direction,
  label = "Google ranking",
  className = "",
}: Props) {
  if (previous == null && current == null) return null;

  let dir: "up" | "down" | "flat" = direction || "flat";
  if (previous != null && current != null) {
    if (current < previous) dir = "up";
    else if (current > previous) dir = "down";
    else dir = "flat";
  }

  let delta = change != null ? fmtDelta(change) : null;
  if (delta == null && previous != null && current != null) {
    delta = fmtDelta(current - previous);
  }

  return (
    <div className={`rk ${dir} ${className}`.trim()}>
      {label ? <div className="rk-label">{label}</div> : null}
      <div className="rk-row" aria-label="Ranking change">
        {previous != null && <span className="rk-old">{fmtPos(previous)}</span>}
        {previous != null && current != null && (
          <span className="rk-arrow" aria-hidden="true">
            →
          </span>
        )}
        {current != null && <span className="rk-new">{fmtPos(current)}</span>}
        {dir !== "flat" && delta != null && (
          <span className={`rk-delta ${dir}`}>
            <span className="rk-tri" aria-hidden="true">
              {dir === "up" ? "▲" : "▼"}
            </span>
            {dir === "up" ? `+${delta}` : `−${delta}`}
          </span>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.rk { display:inline-flex; flex-direction:column; align-items:flex-end; gap:3px; }
.rk-label {
  font-size:10.5px; font-weight:600; color:#9AA3B2;
  text-transform:none; letter-spacing:0; line-height:1.2;
}
.rk-row {
  display:inline-flex; align-items:center; gap:8px;
  font-variant-numeric:tabular-nums;
}
.rk-old {
  font-size:18px; font-weight:500; color:#A0A8B8; letter-spacing:-.02em;
}
.rk-arrow {
  color:#FF6A3D; font-size:15px; font-weight:700; line-height:1;
  transform:translateY(-1px);
}
.rk-new {
  font-size:20px; font-weight:700; color:#12172A; letter-spacing:-.03em;
}
.rk-delta {
  display:inline-flex; align-items:center; gap:3px;
  font-size:13px; font-weight:700; margin-left:2px;
}
.rk-delta.up { color:#16A34A; }
.rk-delta.down { color:#DC2626; }
.rk-tri { font-size:9px; line-height:1; }
`;
