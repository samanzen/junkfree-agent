"use client";

type Payload = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

// Glass tooltip shared by every portal chart, so hover feels identical
// everywhere. Recharts injects `active`, `payload` and `label`.
export default function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Payload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="p-tip">
      {label != null && <div className="p-tip-label">{label}</div>}
      {payload.map((p, i) => (
        <div className="p-tip-row" key={i}>
          <span className="p-tip-key">
            <span className="p-tip-dot" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="p-tip-val">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
