"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useReducedMotion } from "framer-motion";
import ChartTooltip from "./ChartTooltip";

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
            <stop offset="0%" stopColor={color} stopOpacity={0.30} />
            <stop offset="60%" stopColor={color} stopOpacity={0.07} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent3)" />
            <stop offset="50%" stopColor={color} />
            <stop offset="100%" stopColor="var(--accent2)" />
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
          cursor={{ stroke: "var(--accent-line)", strokeWidth: 1.5, strokeDasharray: "4 4" }}
          content={<ChartTooltip />}
        />
        <Area
          type="monotone" dataKey={dataKey}
          stroke={`url(#${gradientId}-line)`} strokeWidth={2.4}
          fill={`url(#${gradientId})`} name={name}
          activeDot={{ r: 5, strokeWidth: 2.5, stroke: "var(--surface)", fill: color }}
          isAnimationActive={!reduce}
          animationDuration={1100}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
