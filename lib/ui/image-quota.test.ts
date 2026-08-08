// Per-brand image quotas.
//
// The defect: the daily cap counted image-bearing drafts across EVERY tenant.
// The first customer to generate an image each day consumed the platform's
// entire allowance, and every other customer was silently told "capped" for
// the rest of the day by somebody else's usage.

import fs from "fs";
import { test, expect } from "vitest";
import { quotaFor, UNLIMITED } from "../capabilities";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");
const ROUTE = "app/api/images/process/route.ts";

// ── the count is per brand ──────────────────────────────────────────────────
test("the quota count is scoped by brand", () => {
  const src = read(ROUTE);
  // Isolate the cap query specifically — the one filtered on created_at.
  const capQuery = [...src.matchAll(/\.from\("drafts"\)([\s\S]*?);/g)]
    .map((m) => m[1])
    .find((q) => /gte\("created_at"/.test(q));
  expect(capQuery, "cap query not found").toBeDefined();
  expect(capQuery).toMatch(/\.eq\("brand_id", brandId\)/);
});

test("no drafts query in the route is unscoped", () => {
  // Item 1 left exactly one unscoped query — the cap. That is now closed, so
  // the route must have none at all.
  const src = read(ROUTE);
  const unscoped = [...src.matchAll(/\.from\("drafts"\)([\s\S]*?);/g)]
    .map((m) => m[1])
    .filter((q) => !/brand_id/.test(q));
  expect(unscoped).toEqual([]);
});

test("the old cross-tenant wording and behaviour are gone", () => {
  const src = read(ROUTE);
  expect(src).not.toMatch(/across all brands/);
  expect(src).not.toMatch(/doneToday >= 1\b/); // hard-coded ceiling
});

// ── the limit lives behind one lookup ──────────────────────────────────────
test("the route asks for the limit instead of hard-coding it", () => {
  const src = read(ROUTE);
  expect(src).toMatch(/const limit = quotaFor\(\{ id: brandId \}, "images_per_day"\)/);
  expect(src).toMatch(/doneToday >= limit/);
});

test("quotaFor is the single source of the number", () => {
  // A future Starter/Pro/Agency split must change this function only.
  const src = read("lib/capabilities.ts");
  expect(src).toMatch(/export function quotaFor\(/);
  expect(src).toMatch(/const DEFAULT_QUOTAS: Record<Quota, number>/);
  expect(quotaFor({ id: "any-brand" }, "images_per_day")).toBe(1);
});

test("quotaFor answers per brand, so tiers can differ later", () => {
  // Same answer today; what matters is that the brand is the argument.
  expect(quotaFor({ id: "brand-a" }, "images_per_day"))
    .toBe(quotaFor({ id: "brand-b" }, "images_per_day"));
  expect(quotaFor.length).toBeGreaterThanOrEqual(2);
});

test("an unlimited tier can never be reached by the >= comparison", () => {
  // Guards the comparison operator: `used >= UNLIMITED` must stay false for
  // any real usage, so an Agency plan is genuinely uncapped.
  expect(Number.MAX_SAFE_INTEGER >= UNLIMITED).toBe(false);
  expect(0 >= UNLIMITED).toBe(false);
});

// ── quota window ────────────────────────────────────────────────────────────
test("the window is a calendar day, so the quota resets", () => {
  const src = read(ROUTE);
  expect(src).toMatch(/startOfDay\.setHours\(0, 0, 0, 0\)/);
  expect(src).toMatch(/gte\("created_at", startOfDay\.toISOString\(\)\)/);
});

test("the response reports usage against the limit", () => {
  // So a capped customer can be told what their own allowance is rather than
  // just being refused.
  expect(read(ROUTE)).toMatch(/capped: true, used: doneToday, limit/);
});

// ── Item 1's isolation must survive ────────────────────────────────────────
test("authorization from Item 1 is intact", () => {
  const src = read(ROUTE);
  expect(src).toMatch(/requireAuth\(req\)/);
  expect(src).toMatch(/requireBrandAccess\(auth, brandId\)/);
  expect(src).toMatch(/getBrandById\(brandId!?\)/);
  expect(src).toMatch(
    /\.update\(\{ body \}\)\.eq\("id", target\.id\)\.eq\("brand_id", brandId\)/
  );
});
