"use client";

// Reusable circular score gauge (0-100). Renders a neutral "—" ring when the
// value is null rather than fabricating a number, so "not connected yet" is
// always visually distinct from "scored zero".
export default function ScoreRing({
  value, size = 72, strokeWidth = 7, label, big,
}: {
  value: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  big?: boolean;
}) {
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
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle className="p-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth} />
        {value != null && (
          <circle
            className="p-ring-val"
            cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        )}
      </svg>
      <div className="p-ring-num">
        <b style={{ color: value == null ? "var(--muted2)" : "var(--text)", fontSize: big ? 30 : undefined }}>
          {value == null ? "—" : Math.round(value)}
        </b>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}
