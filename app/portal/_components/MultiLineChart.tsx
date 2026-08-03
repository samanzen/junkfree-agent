"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useReducedMotion } from "framer-motion";

export type Series = { key: string; name: string; color: string };

// Themed multi-series line chart (position distribution over time, etc).
// Each series draws in with a slight stagger so the chart assembles itself.
export default function MultiLineChart({
  data, series, xKey = "date", height = 268,
}: {
  data: Record<string, string | number | null>[];
  series: Series[];
  xKey?: string;
  height?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey={xKey} tick={{ fill: "var(--muted2)", fontSize: 11 }}
          tickLine={false} axisLine={false} dy={6}
        />
        <YAxis
          tick={{ fill: "var(--muted2)", fontSize: 11 }} tickLine={false}
          axisLine={false} allowDecimals={false} width={40}
        />
        <Tooltip
          cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
          contentStyle={{
            background: "var(--surface)", border: "1px solid var(--line)",
            borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-lg)", color: "var(--text)",
            padding: "9px 12px",
          }}
          labelStyle={{ color: "var(--muted)", marginBottom: 4, fontSize: 11 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11.5, color: "var(--muted)", paddingTop: 10 }}
          iconType="circle" iconSize={7}
        />
        {series.map((s, i) => (
          <Line
            key={s.key} type="monotone" dataKey={s.key} name={s.name}
            stroke={s.color} strokeWidth={2} dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
            isAnimationActive={!reduce}
            animationDuration={900}
            animationBegin={i * 90}
            animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
