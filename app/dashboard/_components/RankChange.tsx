"use client";

/** Ubersuggest-style rank movement: muted old → arrow → bold new + colored delta. */

function fmtPos(n: number): string {
  const r = Math.round(n);
  return String(r);
}

function fmtDelta(n: number): number {
  return Math.max(1, Math.round(Math.abs(n)));
}

type Props = {
  previous?: number | null;
  current?: number | null;
  /** Positive = improved (rank number went down). If omitted, inferred from previous/current. */
  change?: number | null;
  /** Force direction when only one side is known. */
  direction?: "up" | "down";
  className?: string;
};

export default function RankChange({
  previous,
  current,
  change,
  direction,
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
      <div className="rk-track" aria-label="Ranking change">
        {previous != null && <span className="rk-old">{fmtPos(previous)}</span>}
        {previous != null && current != null && <span className="rk-arrow" aria-hidden="true">→</span>}
        {current != null && <span className="rk-new">{fmtPos(current)}</span>}
      </div>
      {dir !== "flat" && delta != null && (
        <span className={`rk-delta ${dir}`}>
          <span className="rk-tri" aria-hidden="true">{dir === "up" ? "▲" : "▼"}</span>
          {dir === "up" ? `+${delta}` : `−${delta}`}
        </span>
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.rk { display:inline-flex; align-items:center; gap:10px; flex-wrap:wrap; }
.rk-track {
  display:inline-flex; align-items:center; gap:10px;
  background:#F3F5F8; border-radius:var(--radius-sm); padding:8px 14px;
}
.rk-old {
  font-size:20px; font-weight:600; color:#9AA3B2; letter-spacing:-.02em;
  font-variant-numeric:tabular-nums;
}
.rk-arrow { color:#94A3B8; font-size:16px; font-weight:600; }
.rk-new {
  font-size:22px; font-weight:700; color:#12172A; letter-spacing:-.03em;
  font-variant-numeric:tabular-nums;
}
.rk-delta {
  display:inline-flex; align-items:center; gap:4px;
  font-size:13px; font-weight:700; padding:5px 10px; border-radius:var(--radius-full);
  font-variant-numeric:tabular-nums;
}
.rk-delta.up { color:#059669; background:rgba(16,185,129,.12); }
.rk-delta.down { color:#DC2626; background:rgba(239,68,68,.12); }
.rk-tri { font-size:10px; line-height:1; }
`;
