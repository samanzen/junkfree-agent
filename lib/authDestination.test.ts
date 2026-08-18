import { test, expect } from "vitest";
import { safeAuthNext, withSiteParam, oauthRedirectTo } from "./authDestination";

test("safeAuthNext only allows portal and onboarding paths", () => {
  expect(safeAuthNext("/portal")).toBe("/portal");
  expect(safeAuthNext("/portal/setup")).toBe("/portal/setup");
  expect(safeAuthNext("/onboarding")).toBe("/onboarding");
  expect(safeAuthNext("/onboarding?site=https://x.com")).toBe("/onboarding?site=https://x.com");
  expect(safeAuthNext("/dashboard")).toBeUndefined();
  expect(safeAuthNext("https://evil.com")).toBeUndefined();
  expect(safeAuthNext("//evil.com")).toBeUndefined();
  expect(safeAuthNext("/portal/../dashboard")).toBeUndefined();
});

test("withSiteParam adds site once", () => {
  expect(withSiteParam("/onboarding", "https://a.com")).toBe("/onboarding?site=https%3A%2F%2Fa.com");
  expect(withSiteParam("/onboarding?site=https%3A%2F%2Fa.com", "https://b.com")).toBe(
    "/onboarding?site=https%3A%2F%2Fa.com"
  );
});

test("oauthRedirectTo points at /auth/callback with next/site", () => {
  const url = oauthRedirectTo("https://app.example.com", {
    next: "/onboarding",
    site: "https://brand.com",
  });
  expect(url).toContain("https://app.example.com/auth/callback?");
  expect(url).toContain("next=%2Fonboarding");
  expect(url).toContain("site=https%3A%2F%2Fbrand.com");
});
