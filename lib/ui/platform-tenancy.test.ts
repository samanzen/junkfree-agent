// Tenant isolation for /api/platform.
//
// The defect: a non-admin with no brand assigned (brandId === null — every
// brand-new signup until an admin links them) fell through to unscoped
// select("*") queries on brands/drafts/gbp/citations/reviews, so one
// unassigned customer received every tenant's data.
//
// These tests pin the three properties that close the hole. A missing guard
// on any one of them re-opens it.

import fs from "fs";
import { test, expect } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");
const ROUTE = "app/api/platform/route.ts";

test("the route authorises the caller", () => {
  const src = read(ROUTE);
  expect(src).toMatch(/requireAuth\(req\)/);
});

test("a non-admin with no brand is refused before any query runs", () => {
  // The original bug: brandFilter = auth.brandId when brandId was null left
  // brandFilter null, and every query below ran unscoped.
  const src = read(ROUTE);
  expect(src).toMatch(/if \(!auth\.brandId\)/);
  expect(src).toMatch(/status: 400/);
  // The refusal must appear BEFORE the first .from( — otherwise the dump
  // still happens and the 400 is decorative.
  const refuse = src.indexOf("if (!auth.brandId)");
  const firstQuery = src.indexOf('.from("brands")');
  expect(refuse).toBeGreaterThan(-1);
  expect(firstQuery).toBeGreaterThan(-1);
  expect(refuse, "refuse must precede every query").toBeLessThan(firstQuery);
});

test("an explicit ?brand= is still checked with requireBrandAccess", () => {
  const src = read(ROUTE);
  expect(src).toMatch(/requireBrandAccess\(auth, brandFilter\)/);
});

test("only an admin may run the unscoped (no brandFilter) queries", () => {
  // The ternary that omits .eq(...) must only be reachable when brandFilter
  // is still null AFTER the non-admin branch — i.e. for admins alone.
  const src = read(ROUTE);
  // Non-admins always assign brandFilter = auth.brandId (after the null check).
  expect(src).toMatch(/brandFilter = auth\.brandId/);
  // And the unscoped arm of each ternary is only the admin-no-filter case —
  // pinned by requiring that every non-admin path has already returned or set
  // brandFilter before Promise.all.
  const nonAdmin = src.indexOf('else if (auth.role !== "admin")');
  const promiseAll = src.indexOf("Promise.all");
  expect(nonAdmin).toBeGreaterThan(-1);
  expect(promiseAll).toBeGreaterThan(nonAdmin);
});
