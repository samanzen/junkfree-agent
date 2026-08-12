// The acquisition funnel: audit → partial report → signup → trial → onboarding.
//
// These guard the properties that quietly break a funnel: an unauthenticated
// endpoint losing its abuse limit, the audited URL failing to reach onboarding,
// or the trial length drifting between marketing copy and signup.

import fs from "fs";
import { test, expect } from "vitest";
import { TRIAL_DAYS } from "./tokens";
import { LOCKED_MODULES, FREE_ISSUE_LIMIT } from "../audit/report";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

test("the landing page leads with the audit, not a bare signup button", () => {
  const src = read("app/page.tsx");
  expect(src).toMatch(/AuditWidget/);
  // A skeptical visitor still needs the non-committal paths.
  expect(src).toMatch(/#how/);
  expect(src).toMatch(/\/pricing/);
});

test("the public audit endpoint limits abuse before it makes any outbound request", () => {
  // Compare CALL sites, not import positions — both names appear at the top of
  // the file in the import block, which says nothing about execution order.
  const src = read("app/api/audit/route.ts");
  const body = src.slice(src.indexOf("export async function POST"));
  const limitAt = body.indexOf("consumeAnonAudit(");
  const fetchAt = body.indexOf("safeFetchPage(");
  expect(limitAt).toBeGreaterThan(-1);
  expect(fetchAt).toBeGreaterThan(-1);
  // Order matters: limiting after the fetch would mean a blocked caller had
  // already spent our egress.
  expect(limitAt).toBeLessThan(fetchAt);
  expect(src).toMatch(/status:\s*429/);
});

test("the audit endpoint routes every fetch through the SSRF guard", () => {
  const src = read("app/api/audit/route.ts");
  // No direct fetch() in the route — it must go through safeFetchPage.
  expect(src).not.toMatch(/\bawait fetch\(/);
  expect(src).toMatch(/safeFetchPage/);

  const guard = read("lib/audit/url.ts");
  expect(guard).toMatch(/redirect:\s*"manual"/);
  expect(guard).toMatch(/assertPublicUrl/);
  expect(guard).toMatch(/AUDIT_MAX_BYTES/);
  expect(guard).toMatch(/AbortSignal\.timeout/);
});

test("anonymous limiting never stores a raw IP", () => {
  const src = read("lib/audit/limit.ts");
  expect(src).toMatch(/createHash\("sha256"\)/);
  // Reads the LAST forwarded entry, which is the only one a caller cannot spoof.
  expect(src).toMatch(/chain\[chain\.length - 1\]/);
});

test("the anonymous limit migration is shipped but separate from tenant limits", () => {
  const sql = read("supabase/013_anon_audit_limits.sql");
  expect(sql).toMatch(/NOT YET APPLIED/);
  expect(sql).toMatch(/create table if not exists anon_audit_limits/);
  expect(sql).toMatch(/grant all privileges on table anon_audit_limits to service_role/);

  // Must NOT reference brands: that FK is precisely why rate_limits cannot hold
  // an anonymous counter. Checked against executable DDL only — the header
  // comment discusses the brands FK on purpose.
  const ddl = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  expect(ddl).not.toMatch(/references brands/);
});

test("the free report is useful on its own and the gate is exact", () => {
  expect(FREE_ISSUE_LIMIT).toBeGreaterThanOrEqual(3);
  const src = read("lib/audit/report.ts");
  // The withheld count is derived from measured issues, never a marketing number.
  expect(src).toMatch(/lockedIssueCount: withheld\.length/);
});

test("locked modules promise capability without fabricating metrics", () => {
  for (const m of LOCKED_MODULES) {
    expect(m.promise).not.toMatch(/\d+%/);
    expect(m.requires.length).toBeGreaterThan(10);
  }
  // Off-page is a real part of the offer, so it must be represented.
  const ids = LOCKED_MODULES.map((m) => m.id);
  expect(ids).toContain("backlinks");
  expect(ids).toContain("rankings");
});

test("trial length is centralised and consistent across the funnel", () => {
  expect(TRIAL_DAYS).toBe(14);
  const signup = read("app/signup/page.tsx");
  expect(signup).toMatch(/TRIAL_DAYS/);
  // No hardcoded trial length competing with the token.
  expect(signup).not.toMatch(/\b(7|14|30)-day/);
});

test("the audited URL survives signup and reaches onboarding", () => {
  const widget = read("app/_components/AuditWidget.tsx");
  expect(widget).toMatch(/\/signup\?site=/);

  const signup = read("app/signup/page.tsx");
  expect(signup).toMatch(/checkUrlShape/); // re-validated, never trusted
  expect(signup).toMatch(/\/onboarding\?site=/);

  const onboarding = read("app/onboarding/page.tsx");
  expect(onboarding).toMatch(/get\("site"\)/);
  expect(onboarding).toMatch(/setSiteUrl/);
});

test("the audit widget uses the shared Field so labels stay wired", () => {
  const src = read("app/_components/AuditWidget.tsx");
  expect(src).toMatch(/import Field from/);
  expect(src).not.toMatch(/<input\b/);
});
