import { test, expect } from "vitest";
import { fillSnapshotGaps, kpiDelta } from "./kpis";

const row = (partial: Record<string, number | null>) => ({
  organic_traffic: null,
  organic_keywords: null,
  backlinks: null,
  referring_domains: null,
  striking_distance: null,
  avg_position: null,
  ai_visibility: null,
  site_health: null,
  ...partial,
});

test("empty KPI cards pick up the last stored value, never a made-up number", () => {
  const current = row({ organic_traffic: 80, organic_keywords: 68, avg_position: null, site_health: null });
  const older = row({ avg_position: 12.4, striking_distance: 9, ai_visibility: 31, site_health: 78 });
  const filled = fillSnapshotGaps(current, [current, older]);
  expect(filled.organic_traffic).toBe(80);
  expect(filled.avg_position).toBe(12.4);
  expect(filled.striking_distance).toBe(9);
  expect(filled.ai_visibility).toBe(31);
  expect(filled.site_health).toBe(78);
  expect(fillSnapshotGaps(current, [current]).avg_position).toBeNull();
});

test("zero is a real measurement, not a missing one", () => {
  const current = row({ striking_distance: 0, avg_position: null });
  const older = row({ striking_distance: 11, avg_position: 8.2 });
  const filled = fillSnapshotGaps(current, [current, older]);
  expect(filled.striking_distance).toBe(0);
  expect(filled.avg_position).toBe(8.2);
});

test("KPI deltas skip null snapshots", () => {
  const history = [
    row({ avg_position: null, organic_traffic: 80 }),
    row({ avg_position: 12.4, organic_traffic: 81 }),
    row({ avg_position: 11.1, organic_traffic: 90 }),
  ];
  expect(kpiDelta(history, "avg_position")).toBeCloseTo(1.3);
  expect(kpiDelta(history, "organic_traffic")).toBe(-1);
  expect(kpiDelta([row({ site_health: 70 })], "site_health")).toBeNull();
});
