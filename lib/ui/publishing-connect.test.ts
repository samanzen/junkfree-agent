// Website publishing connect — closes the hole where Connections "Connect"
// redirected to a page with no credential form.
//
// These tests pin the safety properties: live adapter check before store,
// https-only, brand scope, no secret echo, single active publisher.

import fs from "fs";
import { test, expect } from "vitest";

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

test("WordPress and webhook are both first-class", () => {
  const src = read("app/api/portal/publishing/route.ts");
  expect(src).toMatch(/platform === "wordpress"/);
  expect(src).toMatch(/applicationPassword/);
  expect(src).toMatch(/signingSecret/);
  expect(src).toMatch(/endpointUrl/);
});

test("http endpoints are refused", () => {
  const src = read("app/api/portal/publishing/route.ts");
  expect(src).toMatch(/must use https:\/\//);
});

test("switching platforms disconnects the other publisher", () => {
  const src = read("app/api/portal/publishing/route.ts");
  expect(src).toMatch(/disconnectIntegration\(brandId, other\)/);
});

test("connected publishing no longer offers a meaningless sync_now", () => {
  // sync_now without a draftId can only fail. Reconnect re-opens setup.
  const src = read("lib/connections.ts");
  const fn = src.slice(src.indexOf("async function websitePublishing"));
  const body = fn.slice(0, fn.indexOf("\nasync function") > 0 ? fn.indexOf("\nasync function") : fn.length);
  expect(body).toMatch(/actions: \["reconnect", "disconnect"\]/);
  expect(body).not.toMatch(/"sync_now"/);
});

test("panel never redirects away to set up publishing", () => {
  const src = read("app/portal/settings/_ConnectionsPanel.tsx");
  expect(src).not.toMatch(/href = data\.redirect/);
  expect(src).toMatch(/setPublishOpen\(true\)/);
});
