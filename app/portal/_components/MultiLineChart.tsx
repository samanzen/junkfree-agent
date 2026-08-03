"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export type Series = { key: string; name: string; color: string };

// Themed multi-series line chart (position distribution over time, etc).
export default function MultiLineChart({
  data, series, xKey = "date", height = 260,
}: {
  data: Record<string, string | number | null>[];
  series: Series[];
  xKey?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
        <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: "var(--surface)", border: "1px solid var(--line)",
            borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-lg)", color: "var(--text)",
          }}
          labelStyle={{ color: "var(--muted)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} iconType="circle" iconSize={8} />
        {series.map((s) => (
          <Line
            key={s.key} type="monotone" dataKey={s.key} name={s.name}
            stroke={s.color} strokeWidth={2.2} dot={false} animationDuration={900}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
