import { test, expect } from "vitest";
import { parseReportDays, lookbackDateISO, REPORT_RANGES } from "./reportRange";

test("REPORT_RANGES covers 3d through 90d", () => {
  expect(REPORT_RANGES.map((r) => r.days)).toEqual([3, 7, 30, 90]);
});

test("parseReportDays clamps and falls back", () => {
  expect(parseReportDays("30")).toBe(30);
  expect(parseReportDays("3")).toBe(3);
  expect(parseReportDays(null)).toBe(30);
  expect(parseReportDays("nope")).toBe(30);
  expect(parseReportDays("9999")).toBe(365);
});

test("lookbackDateISO is YYYY-MM-DD", () => {
  expect(lookbackDateISO(7)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
