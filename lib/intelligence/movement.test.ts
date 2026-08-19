import { test, expect } from "vitest";
import { pickLatestAndPrevious, buildMovementMaps, buildPeriodMovementMaps } from "./movement";

test("pickLatestAndPrevious uses newest snapshot, not only today", () => {
  const map = pickLatestAndPrevious([
    {
      keyword_id: "a",
      position: 12,
      clicks: 1,
      impressions: 10,
      ctr: 0.1,
      landing_page: "/",
      captured_date: "2026-08-10",
    },
    {
      keyword_id: "a",
      position: 8,
      clicks: 2,
      impressions: 20,
      ctr: 0.1,
      landing_page: "/",
      captured_date: "2026-08-17",
    },
    {
      keyword_id: "a",
      position: 9,
      clicks: 2,
      impressions: 18,
      ctr: 0.1,
      landing_page: "/",
      captured_date: "2026-08-15",
    },
  ]);
  const snap = map.get("a")!;
  expect(snap.latest.position).toBe(8);
  expect(snap.latest.captured_date).toBe("2026-08-17");
  expect(snap.previous?.position).toBe(9);
  expect(snap.previous?.captured_date).toBe("2026-08-15");
});

test("buildMovementMaps compares latest two distinct dates", () => {
  const { currentDate, previousDate, curMap, prevMap } = buildMovementMaps([
    { keyword: "junk removal", position: 5, clicks: 1, impressions: 10, landing_page: "/", captured_date: "2026-08-18" },
    { keyword: "junk removal", position: 9, clicks: 1, impressions: 10, landing_page: "/", captured_date: "2026-08-12" },
    { keyword: "bin rental", position: 14, clicks: 0, impressions: 5, landing_page: "/", captured_date: "2026-08-18" },
  ]);
  expect(currentDate).toBe("2026-08-18");
  expect(previousDate).toBe("2026-08-12");
  expect(curMap.get("junk removal")?.position).toBe(5);
  expect(prevMap.get("junk removal")).toBe(9);
  expect(prevMap.has("bin rental")).toBe(false);
});

test("buildPeriodMovementMaps compares first vs last day in the window", () => {
  const { currentDate, previousDate, curMap, prevMap } = buildPeriodMovementMaps([
    { keyword: "a", position: 20, clicks: 0, impressions: 1, landing_page: "/", captured_date: "2026-06-01" },
    { keyword: "a", position: 15, clicks: 0, impressions: 1, landing_page: "/", captured_date: "2026-07-01" },
    { keyword: "a", position: 4, clicks: 0, impressions: 1, landing_page: "/", captured_date: "2026-08-18" },
  ]);
  expect(previousDate).toBe("2026-06-01");
  expect(currentDate).toBe("2026-08-18");
  expect(prevMap.get("a")).toBe(20);
  expect(curMap.get("a")?.position).toBe(4);
});
