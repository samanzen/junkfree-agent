// Outcome attribution + guided activation journey — structural guards.

import fs from "fs";
import { test, expect } from "vitest";
import { safePortalReturnPath } from "../google/oauth";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

test("outcomes module and API exist", () => {
  expect(fs.existsSync(`${ROOT}/lib/outcomes.ts`)).toBe(true);
  expect(fs.existsSync(`${ROOT}/app/api/portal/outcomes/route.ts`)).toBe(true);
  expect(fs.existsSync(`${ROOT}/app/portal/results/page.tsx`)).toBe(true);
  const api = read("app/api/portal/outcomes/route.ts");
  expect(api).toMatch(/requireAuth/);
  expect(api).toMatch(/requireBrandAccess/);
  expect(api).toMatch(/seo_action_events/);
  expect(api).toMatch(/attributeAction/);
  expect(read("lib/outcomes.ts")).toMatch(/too_early/);
  expect(read("lib/outcomes.ts")).toMatch(/insufficient_data/);
});

test("Results is in Analyse nav and home surfaces a Results strip", () => {
  expect(read("app/portal/nav.ts")).toMatch(/href: "\/portal\/results"/);
  const home = read("app/portal/page.tsx");
  expect(home).toMatch(/useOutcomeSummary/);
  expect(home).toMatch(/\/portal\/results/);
  expect(home).toMatch(/Outcome trails/);
});

test("setup journey covers the full activation chain", () => {
  expect(fs.existsSync(`${ROOT}/lib/setup.ts`)).toBe(true);
  expect(fs.existsSync(`${ROOT}/app/api/portal/setup/route.ts`)).toBe(true);
  expect(fs.existsSync(`${ROOT}/app/portal/setup/page.tsx`)).toBe(true);
  const setup = read("lib/setup.ts");
  for (const key of [
    "business",
    "search_console",
    "intelligence",
    "publishing",
    "first_approval",
    "operating",
  ]) {
    expect(setup).toContain(key);
  }
  const page = read("app/portal/setup/page.tsx");
  expect(page).toMatch(/start_intelligence/);
  expect(page).toMatch(/focusKeys=\{\["search_console"\]\}/);
  expect(page).toMatch(/focusKeys=\{\["website_publishing"\]\}/);
  expect(page).toMatch(/\/portal\/approvals/);
});

test("onboarding continues into guided setup, not a raw dump to /portal", () => {
  const src = read("app/onboarding/page.tsx");
  expect(src).toMatch(/\/portal\/setup/);
  expect(src).not.toMatch(/router\.push\(["']\/portal["']\)/);
});

test("OAuth returnPath is sealed and open-redirect safe", () => {
  expect(safePortalReturnPath("/portal/setup?step=search_console")).toBe(
    "/portal/setup?step=search_console",
  );
  expect(safePortalReturnPath("https://evil.test")).toBeUndefined();
  expect(safePortalReturnPath("/dashboard")).toBeUndefined();
  expect(safePortalReturnPath("/portal/../admin")).toBeUndefined();

  const start = read("app/api/portal/google/start/route.ts");
  expect(start).toMatch(/safePortalReturnPath/);
  expect(start).toMatch(/returnPath/);
  const cb = read("app/api/portal/google/callback/route.ts");
  expect(cb).toMatch(/state\.returnPath/);
});

test("outcome copy stays humble — no guaranteed-win language in judge", () => {
  const src = read("lib/outcomes.ts");
  expect(src).toMatch(/Correlation, not proof/);
  expect(src).toMatch(/GSC_LAG_DAYS/);
  expect(src).not.toMatch(/guaranteed|definitely worked|proves that/i);
});
