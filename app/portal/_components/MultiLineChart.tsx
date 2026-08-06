"use client";
import dynamic from "next/dynamic";
import type { Series } from "./MultiLineChart.impl";

// Same lazy boundary as TrendChart — see that file for the measurement and the
// reasoning. Props API and rendered output are unchanged.
const Impl = dynamic(() => import("./MultiLineChart.impl"), {
  ssr: false,
  loading: () => null,
});

export type { Series };

export default function MultiLineChart(props: {
  data: Record<string, string | number | null>[];
  series: Series[];
  xKey?: string;
  height?: number;
}) {
  const height = props.height ?? 268;
  return (
    <div style={{ height }} className="p-chart-slot">
      <Impl {...props} />
    </div>
  );
}
