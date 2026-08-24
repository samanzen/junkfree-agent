// Website publishing connect — closes the hole where Connections "Connect"
// redirected to a page with no credential form.
//
// These tests pin the safety properties: live adapter check before store,
// https-only, brand scope, no secret echo, single active publisher, and a
// standard coded-site snippet instead of a custom last mile per customer.

import fs from "fs";
import { test, expect } from "vitest";
import { SITE_PLATFORMS } from "../execution/registry";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

test("publishing route exists and is auth-gated", () => {
  const src = read("app/api/portal/publishing/route.ts");
  expect(src).toMatch(/requireAuth\(req\)/);
  expect(src).toMatch(/requireBrandAccess\(auth, brandId\)/);
  expect(src).toMatch(/enforceRate\(brandId, "dispatch"\)/);
});

test("credentials are only stored after a successful live check", () => {
  const src = read("app/api/portal/publishing/route.ts");
  const checkAt = src.indexOf(".check({ brand, credentials, config })");
  const storeAt = src.indexOf("await upsertIntegrationCredentials");
  expect(checkAt).toBeGreaterThan(-1);
  expect(storeAt).toBeGreaterThan(checkAt);
  expect(src).toMatch(/if \(!check\.ok\)/);
});

test("WordPress, Shopify and coded sites are all first-class", () => {
  const src = read("app/api/portal/publishing/route.ts");
  expect(src).toMatch(/platform === "wordpress"/);
  expect(src).toMatch(/platform === "shopify"/);
  expect(src).toMatch(/applicationPassword/);
  expect(src).toMatch(/signingSecret/);
  expect(SITE_PLATFORMS).toEqual(
    expect.arrayContaining(["wordpress", "shopify", "webhook", "proxy"])
  );
});

test("http addresses are refused", () => {
  const src = read("app/api/portal/publishing/route.ts");
  expect(src).toMatch(/must use https:\/\//);
});

test("switching platforms disconnects the other publisher", () => {
  const src = read("app/api/portal/publishing/route.ts");
  expect(src).toMatch(/disconnectIntegration\(brandId, other/);
});

test("connect pins the writer and stores an unverified capability map", () => {
  const src = read("app/api/portal/publishing/route.ts");
  expect(src).toMatch(/persistBrandWriter\(brandId, platform, capabilityMapFor\(adapter\)\)/);
  expect(src).toMatch(/clearBrandWriter\(brandId\)/);
  expect(src).toMatch(/detectAndStoreSourceOfTruth/);
  expect(src).not.toMatch(/Approved pages can go live/);
  expect(src).toMatch(/Automatic publishing stays off until publishing is proven/);
});

test("connect fails closed when honesty columns cannot be saved", () => {
  const src = read("app/api/portal/publishing/route.ts");
  expect(src).toMatch(/Could not save the publishing connection/);
  expect(src).toMatch(/await disconnectIntegration\(brandId, platform/);
  expect(src).toMatch(/status: 500/);
});

test("connected publishing no longer offers a meaningless sync_now", () => {
  // sync_now without a draftId can only fail. Reconnect re-opens setup.
  const src = read("lib/connections.ts");
  const fn = src.slice(src.indexOf("async function websitePublishing"));
  const next = fn.indexOf("\nasync function");
  const body = fn.slice(0, next > 0 ? next : fn.length);
  expect(body).toMatch(/actions: \["reconnect", "disconnect"\]/);
  expect(body).not.toMatch(/"sync_now"/);
});

test("panel never redirects away to set up publishing", () => {
  const src = read("app/portal/settings/_ConnectionsPanel.tsx");
  expect(src).not.toMatch(/href = data\.redirect/);
  expect(src).toMatch(/setPublishOpen\(true\)/);
  expect(src).toMatch(/codedSiteSnippet/);
  expect(src).toMatch(/Custom-coded|Your own website/);
});

test("disconnect clears every last-mile adapter, not a guessed one", () => {
  const src = read("app/api/portal/connections/route.ts");
  expect(src).toMatch(/for \(const provider of INTEGRATION_SITE_PLATFORMS\)/);
  expect(src).toMatch(/disconnectIntegration\(brandId, provider\)/);
  expect(src).not.toMatch(/account === "webhook" \? "webhook" : "wordpress"/);
});
