// Tenant isolation for the image processor.
//
// The defect: this route took no brand at all. It selected the newest
// image-less draft across EVERY tenant and wrote the generated image back to
// it, guarded only by requireAuth. Any authenticated customer could trigger a
// write to another customer's content, billed to the platform.
//
// These tests pin the three places the brand must appear. A missing filter on
// any one of them re-opens the hole.

import fs from "fs";
import { test, expect } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");
const ROUTE = "app/api/images/process/route.ts";

test("the route authorises the caller against the brand", () => {
  const src = read(ROUTE);
  expect(src).toMatch(/requireAuth\(req\)/);
  expect(src).toMatch(/requireBrandAccess\(auth, brandId\)/);
  // requireBrandAccess returns 400 on a missing brand, so an omitted
  // brand_id can never fall through to an unscoped query.
  expect(src).toMatch(/const \{ brand_id: brandId \}/);
});

test("the draft selection is scoped to the brand", () => {
  const src = read(ROUTE);
  const sel = src.slice(src.indexOf('.from("drafts")'));
  expect(sel.slice(0, sel.indexOf(";"))).toMatch(/\.eq\("brand_id", brandId\)/);
});

test("the write is scoped to the brand as well as the row id", () => {
  // Defence in depth: even a mistake in the selection cannot write across
  // tenants if the UPDATE itself is brand-filtered.
  expect(read(ROUTE)).toMatch(
    /\.update\(\{ body \}\)\.eq\("id", target\.id\)\.eq\("brand_id", brandId\)/
  );
});

test("the brand used for generation comes from the authorised id", () => {
  // Previously getBrandById(target.brand_id) — the brand of whatever row was
  // found, not the caller's. That is what made it cross-tenant.
  const src = read(ROUTE);
  expect(src).toMatch(/getBrandById\(brandId!?\)/);
  expect(src).not.toMatch(/getBrandById\(target\.brand_id\)/);
});

test("no query in the route is left unscoped by brand", () => {
  // Item 1 closed the data queries and left exactly one unscoped — the daily
  // cost cap — which this test recorded so it could not be forgotten. Item 2
  // closed that one too, so the invariant is now simply: none.
  const src = read(ROUTE);
  const queries = [...src.matchAll(/\.from\("drafts"\)([\s\S]*?);/g)].map((m) => m[1]);
  const unscoped = queries.filter((q) => !/brand_id/.test(q));
  expect(unscoped, "every drafts query must be brand-scoped").toEqual([]);
});

test("the caller sends the brand it is operating on", () => {
  const src = read("app/dashboard/page.tsx");
  expect(src).toMatch(/\/api\/images\/process/);
  expect(src).toMatch(/body: JSON\.stringify\(\{ brand_id: brandId \}\)/);
  // And refuses to call it with no brand selected.
  expect(src).toMatch(/async function processImages\(\) \{\s*\n\s*if \(!brandId\) return;/);
});
