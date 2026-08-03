"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export type TrendPoint = { date: string } & Record<string, string | number>;

// Themed area chart used across the portal. Reads its colors from the portal
// CSS variables so it tracks light/dark mode automatically.
export default function TrendChart({
  data, dataKey, name, color = "var(--accent)", height = 240, gradientId = "pTrend",
}: {
  data: TrendPoint[];
  dataKey: string;
  name: string;
  color?: string;
  height?: number;
  gradientId?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
        <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "var(--surface)", border: "1px solid var(--line)",
            borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-lg)", color: "var(--text)",
          }}
          labelStyle={{ color: "var(--muted)" }}
        />
        <Area
          type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5}
          fill={`url(#${gradientId})`} name={name} animationDuration={900}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
