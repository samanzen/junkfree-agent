// Legacy Search Console connect must not bind another tenant's property.
//
// listProperties() returns every property the shared service account can see.
// Accepting any `account` from that list on a customer-reachable POST lets
// Tenant A set brands.gsc_property to Tenant B's site and pull B's rankings.

import fs from "fs";
import { test, expect } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");
const ROUTE = "app/api/portal/connections/route.ts";

test("when Google OAuth is configured, legacy connect is refused", () => {
  const src = read(ROUTE);
  expect(src).toMatch(/googleConfigured\(\)/);
  expect(src).toMatch(/Sign in with Google to connect Search Console/);
  // The refusal must precede listProperties so a crafted POST cannot reach it.
  const oauthGate = src.indexOf("if (googleConfigured())");
  const list = src.indexOf("listProperties()");
  expect(oauthGate).toBeGreaterThan(-1);
  expect(list).toBeGreaterThan(oauthGate);
});

test("the legacy SA path requires an admin", () => {
  // Without OAuth, only an admin may bind a SA-shared property — a customer
  // must never choose from the platform-wide inventory.
  const src = read(ROUTE);
  const scBlock = src.slice(src.indexOf('if (key === "search_console")'));
  expect(scBlock).toMatch(/requireAdmin\(auth\)/);
});

test("customer sync_now cannot enqueue rank_enrich", () => {
  // rank_enrich is weekly/admin-only for DataForSEO cost control. Mapping it
  // from keyword_data sync_now put it on a customer-reachable path.
  const src = read(ROUTE);
  expect(src).toMatch(/search_console: \["rank_sync"\]/);
  expect(src).not.toMatch(/keyword_data:\s*\["rank_enrich"\]/);
  expect(src).not.toMatch(/website_publishing:\s*\["publish"\]/);
});

test("keyword_data connection offers no sync_now action", () => {
  const src = read("lib/connections.ts");
  const start = src.indexOf("async function keywordData");
  const end = src.indexOf("\nfunction unavailable", start);
  const body = src.slice(start, end > start ? end : start + 1200);
  expect(body).toMatch(/actions:\s*\[\]/);
  expect(body).not.toMatch(/\["sync_now"\]/);
});
