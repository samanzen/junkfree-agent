// Structural guards for the public marketing + self-serve signup path.
// Pins: root is a landing page (not a dashboard redirect), signup/onboard
// exist, PLATFORM_NAME is the brand signal, and the master-plan OS vision
// (including Shopify / GBP) may be marketed without "not available" caveats.

import fs from "fs";
import { test, expect } from "vitest";
import { PLATFORM_NAME } from "../ui/tokens";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

test("app/page.tsx is a landing page, not a dashboard-only redirect", () => {
  const src = read("app/page.tsx");
  expect(src).not.toMatch(/redirect\(["']\/dashboard["']\)/);
  expect(src).toMatch(/PLATFORM_NAME/);
  expect(src).toMatch(/Start free trial/);
  expect(src).toMatch(/#how/);
});

test("signup and onboard routes exist", () => {
  expect(fs.existsSync(`${ROOT}/app/signup/page.tsx`)).toBe(true);
  expect(fs.existsSync(`${ROOT}/app/onboarding/page.tsx`)).toBe(true);
  expect(fs.existsSync(`${ROOT}/app/api/portal/onboard/route.ts`)).toBe(true);
  expect(fs.existsSync(`${ROOT}/app/pricing/page.tsx`)).toBe(true);
});

test("landing sells the full master-plan OS vision", () => {
  const src = read("app/page.tsx");
  expect(src).toMatch(/Analyze|Analyse/i);
  expect(src).toMatch(/Recommend/i);
  expect(src).toMatch(/Generate/i);
  expect(src).toMatch(/Execute/i);
  expect(src).toMatch(/Shopify/);
  expect(src).toMatch(/Google Business Profile/);
  expect(src).toMatch(/Outcome attribution/);
  // No gap-advertising status badges on the marketing surface.
  expect(src).not.toMatch(/Not available yet/i);
  expect(src).not.toMatch(/is-partial|is-soon/);
});

test("PLATFORM_NAME is used on marketing surfaces", () => {
  expect(PLATFORM_NAME.length).toBeGreaterThan(0);
  expect(read("app/page.tsx")).toMatch(/PLATFORM_NAME/);
  expect(read("app/pricing/page.tsx")).toMatch(/PLATFORM_NAME/);
  expect(read("app/signup/page.tsx")).toMatch(/PLATFORM_NAME/);
  expect(read("app/_components/MarketingShell.tsx")).toMatch(/PLATFORM_NAME/);
});

test("onboard API enforces auth, rejects admins, and activates self-serve brands", () => {
  const src = read("app/api/portal/onboard/route.ts");
  expect(src).toMatch(/requireAuth\(req\)/);
  expect(src).toMatch(/auth\.role === ["']admin["']/);
  expect(src).toMatch(/auth\.brandId/);
  expect(src).toMatch(/active:\s*true/);
  expect(src).toMatch(/site_url must use https:\/\//);
  expect(src).toMatch(/\.update\(\{\s*brand_id:/);
});

test("customers without a brand are guided to onboarding", () => {
  expect(read("lib/portalAuth.tsx")).toMatch(/\/onboarding/);
  expect(read("app/login/page.tsx")).toMatch(/\/onboarding/);
  expect(read("app/login/page.tsx")).toMatch(/Create an account/);
});

test("Shopify adapter is registered in the execution layer", () => {
  expect(fs.existsSync(`${ROOT}/lib/execution/adapters/shopify.ts`)).toBe(true);
  const registry = read("lib/execution/registry.ts");
  expect(registry).toMatch(/shopifyAdapter/);
  expect(read("lib/execution/types.ts")).toMatch(/"shopify"/);
});
