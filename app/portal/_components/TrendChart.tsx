"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useReducedMotion } from "framer-motion";

export type TrendPoint = { date: string } & Record<string, string | number>;

// Themed area chart used across the portal. Reads its colors from the portal
// CSS variables so it tracks light/dark mode automatically, and draws itself
// in on mount unless the viewer prefers reduced motion.
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
  const reduce = useReducedMotion();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.24} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="date" tick={{ fill: "var(--muted2)", fontSize: 11 }}
          tickLine={false} axisLine={false} dy={6}
        />
        <YAxis
          tick={{ fill: "var(--muted2)", fontSize: 11 }} tickLine={false} axisLine={false} width={44}
        />
        <Tooltip
          cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
          contentStyle={{
            background: "var(--surface)", border: "1px solid var(--line)",
            borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-lg)", color: "var(--text)",
            padding: "9px 12px",
          }}
          labelStyle={{ color: "var(--muted)", marginBottom: 4, fontSize: 11 }}
          itemStyle={{ color: "var(--text)", fontSize: 12.5, fontWeight: 550 }}
        />
        <Area
          type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
          fill={`url(#${gradientId})`} name={name}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          isAnimationActive={!reduce}
          animationDuration={1000}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
