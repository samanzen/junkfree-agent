"use client";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useChartTouch } from "@/lib/ui/useChartTouch";

// The three Recharts blocks that used to sit inline in Overview.tsx, moved
// behind a lazy boundary (see OverviewCharts.tsx for the measurement).
//
// The JSX below is a verbatim move — same elements, same props, same colours,
// same heights, same animation durations. Only two things changed, both
// mechanical: useChartTouch() is called here rather than passed down, and the
// colour constants are re-declared locally instead of imported, so this module
// does not drag Overview back into the bundle it is trying to leave.

const ACCENT = "#6C5CE7";
const GREEN = "#00B894";
const AMBER = "#F5B461";

type ChartRow = Record<string, string | number | null>;
type ColorConfig = { key: string; name: string; color: string; gradient: string };

export function TrendArea({ data, cc }: { data: ChartRow[]; cc: ColorConfig }) {
  const t = useChartTouch();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={cc.gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cc.color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={cc.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
        <XAxis {...t.xAxis} dataKey="d" tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#EEF0F4" }} />
        <YAxis tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip {...t.tooltip} contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,.08)" }} />
        <Area type="monotone" dataKey={cc.key} stroke={cc.color} strokeWidth={2.5}
          fill={`url(#${cc.gradient})`} name={cc.name} animationDuration={900} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function WeeklyBars({ data }: { data: { week: string; count: number }[] }) {
  const t = useChartTouch();
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
        <XAxis {...t.xAxis} dataKey="week" tick={{ fill: "#B2BAC8", fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip {...t.tooltip} contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} name="Drafts" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HealthVsPosition({ data }: { data: ChartRow[] }) {
  const t = useChartTouch();
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
        <XAxis {...t.xAxis} dataKey="d" tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#EEF0F4" }} />
        <YAxis yAxisId="left" tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9AA3B2", fontSize: 11 }} tickLine={false} axisLine={false} reversed />
        <Tooltip {...t.tooltip} contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 10, fontSize: 12 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Line yAxisId="left" type="monotone" dataKey="health" stroke={GREEN} strokeWidth={2} dot={false} name="Site health %" animationDuration={900} />
        <Line yAxisId="right" type="monotone" dataKey="position" stroke={AMBER} strokeWidth={2} dot={false} name="Avg. position" animationDuration={900} />
      </LineChart>
    </ResponsiveContainer>
  );
}
