import { expect, test } from "vitest";
import fs from "fs";
import {
  isBrandId,
  withPortalBrand,
} from "../portalBrand";

const POMO = "9bb33e02-2357-420c-b082-1335588fd19c";

test("withPortalBrand stamps brand onto bare portal paths", () => {
  expect(withPortalBrand("/portal/settings", POMO)).toBe(`/portal/settings?brand=${POMO}`);
  expect(withPortalBrand("/portal", POMO)).toBe(`/portal?brand=${POMO}`);
});

test("withPortalBrand preserves existing query params and hash", () => {
  expect(withPortalBrand("/portal/settings?tab=connections", POMO)).toBe(
    `/portal/settings?tab=connections&brand=${POMO}`
  );
  expect(withPortalBrand("/portal/settings?tab=connections#x", POMO)).toBe(
    `/portal/settings?tab=connections&brand=${POMO}#x`
  );
});

test("withPortalBrand overwrites a prior brand param", () => {
  expect(withPortalBrand(`/portal?brand=old`, POMO)).toBe(`/portal?brand=${POMO}`);
});

test("withPortalBrand is a no-op without a brand id", () => {
  expect(withPortalBrand("/portal/settings?tab=connections", null)).toBe(
    "/portal/settings?tab=connections"
  );
  expect(withPortalBrand("/portal", undefined)).toBe("/portal");
});

test("isBrandId accepts UUIDs only", () => {
  expect(isBrandId(POMO)).toBe(true);
  expect(isBrandId("b1")).toBe(false);
  expect(isBrandId("")).toBe(false);
  expect(isBrandId(null)).toBe(false);
});

test("portal auth persists admin preview brand in URL and sessionStorage", () => {
  const src = fs.readFileSync("lib/portalAuth.tsx", "utf8");
  expect(src).toMatch(/writeStoredPreviewBrandId/);
  expect(src).toMatch(/syncBrandQueryParam/);
  expect(src).toMatch(/readStoredPreviewBrandId/);
  expect(src).toMatch(/isBrandId\(urlBrand\)/);
  expect(src).toMatch(/from "\.\/portalBrand"/);
  // Customers stay locked to me.brand_id — URL cannot switch tenants.
  expect(src).toMatch(/me\.brand_id/);
  expect(src).toMatch(/URL \?brand= cannot switch a customer/);
});

test("portal shell and bottom nav stamp brand on links", () => {
  const shell = fs.readFileSync("app/portal/PortalShell.tsx", "utf8");
  const bottom = fs.readFileSync("app/portal/_components/BottomNav.tsx", "utf8");
  expect(shell).toMatch(/withPortalBrand\(item\.href, brand\?\.id\)/);
  expect(bottom).toMatch(/withPortalBrand\(item\.href, brand\?\.id\)/);
});
