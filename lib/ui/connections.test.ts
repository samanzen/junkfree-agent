// Connections / Integration Center.
//
// The defect being fixed: the Connections tab derived two booleans from brand
// columns and rendered "Connected"/"Not connected". It could not report when
// data last arrived, could not act, and could not explain any state.
//
// These tests pin the properties that make the replacement honest rather than
// merely prettier — every state explains itself, nothing is a dead end, and no
// second implementation of auth, credentials or job dispatch was introduced.

import fs from "fs";
import { test, expect } from "vitest";
import { ACTIONABLE_KEYS } from "../connections";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

// ── no duplicate implementations ────────────────────────────────────────────
test("connection state reuses the existing clients rather than reimplementing them", () => {
  const src = read("lib/connections.ts");
  // Credentials, adapters and Google auth all come from their existing homes.
  expect(src).toMatch(/from "\.\/integrations"/);
  expect(src).toMatch(/from "\.\/execution\/registry"/);
  expect(src).toMatch(/from "\.\/gsc"/);
  // No second Google JWT and no second credential decryption path.
  expect(src).not.toMatch(/new JWT|google-auth-library/);
  expect(src).not.toMatch(/decryptCredentials/);
});

test("the route dispatches work through the existing queue", () => {
  // Sync must enqueue a job, never run agent work inside the request.
  const src = read("app/api/portal/connections/route.ts");
  expect(src).toMatch(/from "@\/lib\/queue"/);
  expect(src).toMatch(/await enqueue\(brandId, kinds\[0\], \{\}\)/);
  expect(src).not.toMatch(/callClaude|auditSite|fullKeywordSync/);
});

test("website publishing sends the user to the existing setup page", () => {
  // Re-entering credentials here would be a second publishing config UI.
  expect(read("app/api/portal/connections/route.ts")).toMatch(/redirect: "\/portal\/website"/);
});

// ── the full workflow exists ────────────────────────────────────────────────
test("every required action is implemented", () => {
  const src = read("app/api/portal/connections/route.ts");
  for (const a of ["sync_now", "disconnect", "reconnect", "connect"]) {
    expect(src).toContain(a);
  }
});

test("connecting verifies access instead of trusting the client", () => {
  // A property the service account cannot read must be refused, not stored.
  const src = read("app/api/portal/connections/route.ts");
  expect(src).toMatch(/available = await listProperties\(\)/);
  expect(src).toMatch(/!available\.some\(\(p\) => p\.siteUrl === wanted\)/);
  expect(src).toMatch(/status: 403/);
});

test("sync does not stack duplicate jobs", () => {
  const src = read("app/api/portal/connections/route.ts");
  expect(src).toMatch(/pendingCount\(brandId, kinds\)/);
  expect(src).toMatch(/queued: false/);
});

test("the route is authenticated and brand-scoped", () => {
  const src = read("app/api/portal/connections/route.ts");
  expect((src.match(/requireAuth\(req\)/g) || []).length).toBe(2); // GET + POST
  expect((src.match(/requireBrandAccess\(auth, brandId\)/g) || []).length).toBe(2);
});

// ── no unexplained states, no dead ends ─────────────────────────────────────
test("every connection state carries a reason", () => {
  // `why` is required by the type, so this guards it staying required.
  const src = read("lib/connections.ts");
  expect(src).toMatch(/\bwhy: string;/);
  expect(src).not.toMatch(/\bwhy\?: string/);
});

test("a service that cannot be connected states what it would take", () => {
  const src = read("lib/connections.ts");
  // The unavailable() helper takes `requirement` as a required argument, so an
  // unavailable service cannot be declared without one.
  expect(src).toMatch(/function unavailable\(\s*key: ConnectionKey, name: string, purpose: string, why: string, requirement: string\s*\)/);
  // And it offers no actions, so it can never render a button that does nothing.
  expect(src).toMatch(/actions: \[\], accounts: null, requirement,/);
});

test("GBP and Analytics are declared unavailable rather than fake-connectable", () => {
  // They are declared through unavailable(), which returns no actions and
  // requires customer-facing `requirement` copy. Asserting on the wording
  // itself was wrong: it pinned the developer language Priority 2.1 removed.
  const src = read("lib/connections.ts");
  for (const key of ["google_business_profile", "google_analytics"]) {
    expect(src).toMatch(new RegExp(`unavailable\\(\\s*"${key}"`));
  }
});

test("the panel renders the reason for every row", () => {
  const src = read("app/portal/settings/_ConnectionsPanel.tsx");
  expect(src).toMatch(/className="p-conn-why">\{row\.why\}/);
  expect(src).toMatch(/row\.requirement &&/);
});

test("the static connection list is gone", () => {
  const src = read("app/portal/settings/page.tsx");
  // The old hardcoded rows derived status from brand columns.
  expect(src).not.toMatch(/connected=\{!!brand\.gsc_property\}/);
  expect(src).not.toMatch(/function Connection\(/);
  expect(src).toMatch(/<ConnectionsPanel brandId=\{brand\.id\}/);
});

// ── freshness is reported honestly ──────────────────────────────────────────
test("the freshness query covers the whole window", () => {
  // Search Console orders rows by clicks, not date. A small rowLimit returns
  // arbitrary days and reports a stale "data through" date — measured saying
  // Jul 19 for a property with data through Aug 4.
  const src = read("lib/gsc.ts");
  expect(src).toMatch(/query\(gscProperty, \["date"\], 100\)/);
});

test("freshness is described as data age, not as sync time", () => {
  // GSC lags ~2 days; "synced 5 minutes ago" would overstate how current the
  // numbers are.
  expect(read("lib/connections.ts")).toMatch(/Search Console data through/);
});

// ── the model itself ────────────────────────────────────────────────────────
test("only genuinely actionable services are listed as such", () => {
  expect(ACTIONABLE_KEYS).toContain("search_console");
  expect(ACTIONABLE_KEYS).not.toContain("google_business_profile");
  expect(ACTIONABLE_KEYS).not.toContain("google_analytics");
});
