// Structural guards for the public marketing + self-serve signup path.
// Pins: root is a landing page (not a dashboard redirect), signup/onboard
// exist, claims stay honest (no Shopify-as-available), and PLATFORM_NAME is
// the brand signal rather than a hard-coded product string drifting per page.

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

test("marketing does not claim Shopify is available", () => {
  const files = [
    "app/page.tsx",
    "app/pricing/page.tsx",
    "app/_components/MarketingShell.tsx",
  ];
  // Positive-claim shapes only — "Shopify … not available" must remain allowed.
  const POSITIVE = /\bShopify\b(?![^.\n]{0,60}\bnot available\b)(?![^.\n]{0,60}\bnot.*yet\b)[^.\n]{0,40}\b(available|live|supported|connected)\b/i;
  for (const file of files) {
    const src = read(file);
    expect(src, file).not.toMatch(POSITIVE);
    if (/\bShopify\b/i.test(src)) {
      expect(src, file).toMatch(/not available|not available yet|isn't available/i);
    }
  }
  expect(read("app/page.tsx")).toMatch(/Not available yet/);
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
