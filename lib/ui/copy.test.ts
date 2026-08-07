// Priority 2.1: the portal must read like a product, not like internal tooling.
//
// What went wrong: the Connections page shipped strings such as "Requires a
// Google Cloud OAuth application with the Business Profile API enabled and a
// verified consent screen", and the panel rendered raw provider/database
// errors straight into the page. A customer can act on none of that.
//
// This is a lint, not a style opinion: it fails the build when implementation
// vocabulary appears in a string a customer reads.

import fs from "fs";
import { test, expect } from "vitest";
import { toPublic, type ConnectionState } from "../connections";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

/**
 * Vocabulary that means something to us and nothing to a customer.
 * `API` is matched as a standalone word so "capabilities" is unaffected.
 */
const DEV_TERMS = [
  /\bOAuth\b/i,
  /\bGoogle Cloud\b/i,
  /\bclient (id|secret)\b/i,
  /\bconsent screen\b/i,
  /\bservice account\b/i,
  /\bAPI\b/,
  /\bendpoint\b/i,
  /\bDATAFORSEO\b/i,
  /\bPostgres\b/i,
  /\bRLS\b/i,
  /\bmigration\b/i,
  /\bschema\b/i,
  /\bnull\b/,
  /\bundefined\b/,
];

/**
 * String literals in a file, ignoring comments and import paths.
 *
 * Scanned character by character rather than by regex: a naive /"([^"]+)"/
 * matches from one literal's closing quote to the next literal's opening
 * quote, so it reports the CODE between two strings as if it were copy. That
 * false-positived on `detail: null, accounts: null,` on the first run.
 */
function customerStrings(src: string): string[] {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const c = clean[i];
    if (c === '"' || c === "`") {
      const quote = c;
      let j = i + 1;
      let buf = "";
      while (j < clean.length && clean[j] !== quote) {
        if (clean[j] === "\\") { buf += clean[j + 1] ?? ""; j += 2; continue; }
        buf += clean[j];
        j++;
      }
      // Template literals interpolate code; drop the ${...} spans.
      const text = quote === "`" ? buf.replace(/\$\{[^}]*\}/g, " ") : buf;
      // Only prose: needs a space and sentence-like length.
      if (text.length >= 12 && /\s/.test(text) && !/^[@./]/.test(text)) out.push(text);
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

const CUSTOMER_FACING = [
  "lib/connections.ts",
  "app/api/portal/connections/route.ts",
  "app/portal/settings/_ConnectionsPanel.tsx",
];

test("the string extractor actually finds copy (guards the lint itself)", () => {
  const all = CUSTOMER_FACING.flatMap((f) => customerStrings(read(f)));
  expect(all.length).toBeGreaterThan(20);
});

for (const file of CUSTOMER_FACING) {
  test(`${file} contains no developer language`, () => {
    const offenders: string[] = [];
    for (const s of customerStrings(read(file))) {
      for (const term of DEV_TERMS) {
        if (term.test(s)) offenders.push(`${term} -> "${s.slice(0, 90)}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
}

// ── diagnostics must never reach the browser ────────────────────────────────
test("raw errors are stripped before the customer sees them", () => {
  const states = [
    {
      key: "website_publishing", name: "Website publishing", purpose: "p",
      status: "error", why: "We can't check this right now.",
      detail: null, lastSyncAt: null, lastSyncLabel: null,
      lastError: "42501: permission denied for table brand_integrations",
      actions: [], accounts: null, requirement: null,
    } as ConnectionState,
  ];
  const [publicState] = toPublic(states, "test-brand");
  expect("lastError" in publicState).toBe(false);
  expect(JSON.stringify(publicState)).not.toContain("42501");
});

test("the panel never renders a diagnostic field", () => {
  // `data.detail` from the route IS rendered, and that is correct — it now
  // carries customer copy ("Please try again in a moment"), which the copy
  // lint above holds to the same standard as everything else. What must never
  // be rendered is the raw provider error, which toPublic() strips entirely.
  const src = read("app/portal/settings/_ConnectionsPanel.tsx");
  expect(src).not.toMatch(/row\.lastError/);
});

test("the route returns the stripped shape", () => {
  const src = read("app/api/portal/connections/route.ts");
  expect(src).toMatch(/toPublic\(await describeConnections\(brand\), brand\.slug\)/);
});

// ── an unavailable service sells the outcome, not the plumbing ──────────────
test("services that aren't ready describe what the customer will get", () => {
  const src = read("lib/connections.ts");
  for (const phrase of ["Once this is ready", "isn't available yet"]) {
    expect(src).toContain(phrase);
  }
  // And no Connect button that cannot work.
  expect(src).toMatch(/actions: \[\], accounts: null, requirement,/);
});

test("the account is shown as a website, not a provider identifier", () => {
  const src = read("lib/connections.ts");
  expect(src).toMatch(/const siteLabel = \(p: string\) =>/);
  expect(src).toMatch(/detail: siteLabel\(selected\)/);
  // Google's own permission wording is not surfaced.
  expect(src).not.toMatch(/: p\.permissionLevel,/);
});
