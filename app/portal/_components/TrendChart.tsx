"use client";
import dynamic from "next/dynamic";
import type { TrendPoint } from "./TrendChart.impl";

// Lazy boundary for Recharts.
//
// MEASURED: chunk 616 is 353 kB uncompressed and contains Recharts. Routes
// that render a chart shipped 317-326 kB of First Load JS; routes that do not
// shipped 191 kB. Recharts alone was ~130 kB on four routes, eagerly, before
// anything was drawn.
//
// Every chart in the portal sits below the fold — under the KPI row on the
// dashboard, inside a panel on Technical SEO, inside a tab on Intelligence —
// so none of them is needed for first paint.
//
// The split is inside the component rather than at the call sites, so no page
// changes and no import moves. Callers keep the identical props API.
//
// SAFE BECAUSE: the placeholder reserves exactly the same height the chart
// will occupy, so nothing reflows when it arrives (the Phase 5 layout-stability
// guarantee). ssr:false because Recharts measures the DOM to size itself and
// has no meaningful server render anyway.
const Impl = dynamic(() => import("./TrendChart.impl"), {
  ssr: false,
  loading: () => null,
});

export type { TrendPoint };

export default function TrendChart(props: {
  data: TrendPoint[];
  dataKey: string;
  name: string;
  color?: string;
  height?: number;
  gradientId?: string;
}) {
  const height = props.height ?? 240;
  return (
    // Height is reserved by the wrapper, not the placeholder, so the reserved
    // box is identical whether the chart has loaded or not.
    <div style={{ height }} className="p-chart-slot">
      <Impl {...props} />
    </div>
  );
}
