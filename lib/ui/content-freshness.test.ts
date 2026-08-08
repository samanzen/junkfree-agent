// Page performance must show the newest data that EXISTS, not only today's.
//
// The defect: the route filtered captured_date = today. The sync that writes
// those rows runs at 06:00 UTC, so the Website page reported "No page data
// yet" every day between midnight UTC and the sync completing — roughly six
// and a half hours daily — while thousands of rows sat in the table. Measured
// at 01:02 UTC: 2,656 rows for junkfree, 0 of them dated "today", page blank.

import fs from "fs";
import { test, expect } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");
const ROUTE = "app/api/intelligence/content/route.ts";

test("the query anchors on the newest available date, not on today", () => {
  const src = read(ROUTE);
  expect(src).toMatch(/\.order\("captured_date", \{ ascending: false \}\)/);
  expect(src).toMatch(/\.eq\("captured_date", latestDate\)/);
  // The old behaviour must be gone entirely.
  expect(src).not.toMatch(/\.eq\("captured_date", today\)/);
  expect(src).not.toMatch(/const today = new Date\(\)/);
});

test("the comparison is anchored to the data, not to the wall clock", () => {
  // "7 days before today" silently compares against nothing whenever the data
  // itself is a day or two behind — which is the normal state, since Search
  // Console lags.
  const src = read(ROUTE);
  expect(src).toMatch(/Date\.parse\(latestDate\) - 7 \* 864e5/);
  expect(src).not.toMatch(/const sevenDaysAgo = new Date\(Date\.now\(\)/);
});

test("genuinely-empty is distinguished from sync-is-late", () => {
  const src = read(ROUTE);
  expect(src).toMatch(/if \(!latestDate\)/);
  expect(src).toMatch(/pages: \[\], total: 0, data_date: null/);
});

test("the response tells the caller how fresh the data is", () => {
  const src = read(ROUTE);
  expect(src).toMatch(/data_date: latestDate/);
  expect(src).toMatch(/comparison_date: comparisonDate/);
});

test("no trend is claimed without a baseline to compare against", () => {
  // With under 7 days of history every page came back "new", which asserts
  // something untrue about all of them.
  const src = read(ROUTE);
  expect(src).toMatch(/const status = !comparisonDate \? "unknown"/);
});

test("the page shows the data date instead of implying it is current", () => {
  const src = read("app/portal/website/page.tsx");
  expect(src).toMatch(/Search Console data through \$\{formatDataDate\(dataDate\)\}/);
  expect(src).toMatch(/setDataDate\(d\.data_date \|\| null\)/);
});

test("the data date is formatted in UTC", () => {
  // A bare YYYY-MM-DD parses as UTC midnight, which renders as the PREVIOUS
  // day in any negative-offset timezone — reporting data staler than it is.
  const src = read("app/portal/website/page.tsx");
  expect(src).toMatch(/new Date\(`\$\{iso\}T00:00:00Z`\)/);
  expect(src).toMatch(/timeZone: "UTC"/);
});

test("an unknown trend renders as unknown, not as stable", () => {
  const src = read("app/portal/website/page.tsx");
  expect(src).toMatch(/status === "unknown"/);
});
