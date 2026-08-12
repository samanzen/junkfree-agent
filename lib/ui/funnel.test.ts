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
  // Site rides through destinationForSession → /onboarding?site=
  expect(signup).toMatch(/destinationForSession/);
  expect(signup).toMatch(/site:\s*site/);
  expect(read("lib/authDestination.ts")).toMatch(/withSiteParam/);
  expect(read("lib/authDestination.ts")).toMatch(/\/onboarding/);

  const onboarding = read("app/onboarding/page.tsx");
  expect(onboarding).toMatch(/get\("site"\)/);
  expect(onboarding).toMatch(/setSiteUrl/);
});

test("the audit widget uses the shared Field so labels stay wired", () => {
  const src = read("app/_components/AuditWidget.tsx");
  expect(src).toMatch(/import Field from/);
  expect(src).not.toMatch(/<input\b/);
});

test("no client component imports the server-only URL module", () => {
  // lib/audit/url.ts imports dns/promises at module scope. Reaching it from a
  // "use client" file pulls a Node built-in into the browser bundle and fails
  // the production build — which typecheck and unit tests both pass straight
  // through, so it needs its own guard.
  const clientFiles = ["app/signup/page.tsx", "app/_components/AuditWidget.tsx", "app/page.tsx"];
  for (const f of clientFiles) {
    const src = read(f);
    expect(src, f).not.toMatch(/from "@\/lib\/audit\/url"/);
  }

  // And the shape module must stay free of Node built-ins so it is safe to share.
  const shape = read("lib/audit/url-shape.ts");
  expect(shape).not.toMatch(/from "(dns|fs|net|crypto|http|https)/);
  expect(shape).not.toMatch(/require\((["'])(dns|fs|net|crypto)/);
});

test("the landing page states the product category before any benefit line", () => {
  // A visitor must know WHAT this is on arrival, not infer it from a promise.
  const src = read("app/page.tsx");
  expect(src).toMatch(/AI SEO operating system/i);
  // Intelligence loop verbs — compete/diagnose was replaced by the master-plan OS loop.
  for (const verb of ["Analyze", "Recommend", "Generate", "Execute"]) {
    expect(src).toMatch(new RegExp(verb, "i"));
  }
  const badgeAt = src.search(/AI SEO operating system/i);
  const h1At = src.indexOf('id="mk-hero-title"');
  expect(badgeAt).toBeGreaterThan(-1);
  expect(badgeAt).toBeLessThan(h1At);
});

test("marketing runs one modern sans, with no heavy display face", () => {
  // Syne read as a design studio rather than software, and cost an extra font
  // download on the page whose speed decides whether the audit form is seen.
  const layout = read("app/layout.tsx");
  // Check the import statement itself, not the whole file — the comment above
  // it names the removed faces on purpose.
  const fontImport = layout.match(/import \{([^}]*)\} from "next\/font\/google"/)?.[1] || "";
  expect(fontImport).toContain("Inter");
  expect(fontImport).not.toContain("Syne");
  expect(fontImport).not.toContain("DM_Sans");
  expect(layout).not.toMatch(/DM_Sans\(/);
  expect(layout).not.toMatch(/\bSyne\(/);

  const shell = read("app/_components/MarketingShell.tsx");
  expect(shell).toMatch(/--mk-font-display: var\(--font-sans\)/);
  expect(shell).toMatch(/--mk-font-body: var\(--font-sans\)/);

  // Nothing on marketing should be heavier than a restrained 620. Display is
  // distinguished by size and tracking, not by weight.
  const strays: string[] = [];
  for (const m of shell.matchAll(/font-weight:\s*(\d{3})/g)) {
    if (Number(m[1]) > 620) strays.push(m[1]);
  }
  expect(strays).toEqual([]);
});

test("URL validation has exactly one implementation", () => {
  // A second copy would drift, and the copy that drifted would be the one
  // guarding SSRF.
  const server = read("lib/audit/url.ts");
  expect(server).toMatch(/from "\.\/url-shape"/);
  expect(server).not.toMatch(/export function checkUrlShape/);
  expect(server).not.toMatch(/const BLOCKED_V4/);
});
