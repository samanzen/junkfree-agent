// Phase 7: bundle boundaries.
//
// These guard the measured win: Recharts (a 353 kB chunk) must stay behind a
// lazy boundary. A single static `from "recharts"` in a page or an eagerly
// imported component silently pulls it back into that route's initial bundle,
// and nothing else in the suite would notice.

import fs from "fs";
import { test, expect } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(`${ROOT}/${dir}`, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, acc);
    else if (p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

// Only these may import Recharts directly. Each is loaded through next/dynamic
// and is never in a route's initial bundle.
const LAZY_CHART_MODULES = [
  "app/portal/_components/TrendChart.impl.tsx",
  "app/portal/_components/MultiLineChart.impl.tsx",
  "app/dashboard/OverviewCharts.impl.tsx",
  // Reached only through the dynamically imported Intelligence tab.
  "app/dashboard/intelligence/PositionDistribution.tsx",
  "app/dashboard/intelligence/KeywordTable.tsx",
];

test("Recharts is imported only by modules behind a lazy boundary", () => {
  const offenders = walk("app")
    .filter((f) => /from "recharts"/.test(read(f)))
    .filter((f) => !LAZY_CHART_MODULES.includes(f));
  expect(offenders).toEqual([]);
});

test("every chart wrapper actually defers its implementation", () => {
  for (const w of [
    "app/portal/_components/TrendChart.tsx",
    "app/portal/_components/MultiLineChart.tsx",
    "app/dashboard/OverviewCharts.tsx",
  ]) {
    const src = read(w);
    expect(src).toContain('from "next/dynamic"');
    expect(src).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\(/);
  }
});

test("the Intelligence tab is code-split out of the dashboard's initial bundle", () => {
  const src = read("app/dashboard/page.tsx");
  expect(src).toMatch(/dynamic\(\(\) => import\("\.\/intelligence\/IntelligencePage"\)/);
  expect(src).not.toMatch(/^import IntelligencePage from/m);
});

test("chart slots reserve their height so deferral cannot cause layout shift", () => {
  // The whole point of the lazy boundary is that the user never sees it. A
  // placeholder that does not reserve the chart's height would trade bundle
  // size for a visible reflow — the Phase 5 stability guarantee.
  const portal = read("app/portal/_components/TrendChart.tsx");
  expect(portal).toMatch(/style=\{\{ height \}\}/);

  const overview = read("app/dashboard/OverviewCharts.tsx");
  for (const h of [220, 80, 200]) {
    expect(overview).toContain(`height: ${h}`);
  }
});

test("wrappers re-export the types their callers import", () => {
  // Callers import TrendPoint/Series from the wrapper, not the impl; if the
  // re-export is dropped the build breaks in pages, not here.
  expect(read("app/portal/_components/TrendChart.tsx")).toMatch(/export type \{ TrendPoint \}/);
  expect(read("app/portal/_components/MultiLineChart.tsx")).toMatch(/export type \{ Series \}/);
});
