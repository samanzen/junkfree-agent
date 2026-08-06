"use client";
import dynamic from "next/dynamic";

// Lazy boundary for the admin Overview's three Recharts blocks.
//
// MEASURED: /dashboard shipped 326 kB of First Load JS. Deferring the
// Intelligence tab took it to 315 kB, and it stopped there because Overview
// still imported Recharts statically — keeping the 353 kB chunk in the initial
// bundle for every admin, on the default tab, before any chart was visible.
//
// All three charts sit below the KPI row, so none is needed for first paint.
//
// SAFE BECAUSE: each wrapper reserves the exact height its chart renders at
// (220 / 80 / 200), so the panel does not reflow when the chart arrives. The
// JSX inside the impl is a verbatim move.

type ChartRow = Record<string, string | number | null>;
type ColorConfig = { key: string; name: string; color: string; gradient: string };

// next/dynamic requires its options to be an object literal — a helper that
// returns the same object is rejected at build time, so these are spelled out.
const TrendAreaImpl = dynamic(
  () => import("./OverviewCharts.impl").then((m) => m.TrendArea),
  { ssr: false, loading: () => <div style={{ height: 220 }} /> });
const WeeklyBarsImpl = dynamic(
  () => import("./OverviewCharts.impl").then((m) => m.WeeklyBars),
  { ssr: false, loading: () => <div style={{ height: 80 }} /> });
const HealthVsPositionImpl = dynamic(
  () => import("./OverviewCharts.impl").then((m) => m.HealthVsPosition),
  { ssr: false, loading: () => <div style={{ height: 200 }} /> });

export function TrendArea(props: { data: ChartRow[]; cc: ColorConfig }) {
  return <div style={{ height: 220 }}><TrendAreaImpl {...props} /></div>;
}
export function WeeklyBars(props: { data: { week: string; count: number }[] }) {
  return <div style={{ height: 80 }}><WeeklyBarsImpl {...props} /></div>;
}
export function HealthVsPosition(props: { data: ChartRow[] }) {
  return <div style={{ height: 200 }}><HealthVsPositionImpl {...props} /></div>;
}
