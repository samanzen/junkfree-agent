// White-label: no tenant's identity may appear in production code.
//
// The defect: app/layout.tsx set the browser title to one customer's business
// name, so EVERY tenant saw "Junk Free" in their tab.
//
// The scan below is the real guard. It walks all production source with
// comments stripped, so documentation describing past incidents stays
// readable while a live reference fails the build.

import fs from "fs";
import { test, expect } from "vitest";
import { PLATFORM_NAME, pageTitle } from "../ui/tokens";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

const SKIP_DIR = /node_modules|\.next|\.git/;
const SKIP_FILE = /\.test\.|\.spec\.|\.sql$|\.md$/;

function walk(d: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(`${ROOT}/${d}`, { withFileTypes: true })) {
    const p = `${d}/${e.name}`;
    if (SKIP_DIR.test(p)) continue;
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/** Production source with comments removed, so only live code is inspected. */
function productionCode(): { file: string; code: string }[] {
  return ["app", "lib"]
    .flatMap((r) => walk(r))
    .filter((f) => /\.(ts|tsx|js|jsx|json|css)$/.test(f))
    .filter((f) => !SKIP_FILE.test(f))
    .map((f) => ({
      file: f,
      code: read(f)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/(\s)\/\/[^\n"'`]*$/gm, "$1"),
    }));
}

test("the scanner actually reads the codebase (guards the guard)", () => {
  const files = productionCode();
  expect(files.length).toBeGreaterThan(100);
  expect(files.some((f) => f.file === "app/layout.tsx")).toBe(true);
});

test("no tenant business name appears in production code", () => {
  const offenders = productionCode()
    .filter((f) => /junk\s*free|pomo\s*build/i.test(f.code))
    .map((f) => f.file);
  expect(offenders).toEqual([]);
});

test("no tenant domain appears in production code", () => {
  const offenders = productionCode()
    .filter((f) => /junkfree\.(ca|com)|pomobuild\.(ca|com)/i.test(f.code))
    .map((f) => f.file);
  expect(offenders).toEqual([]);
});

test("no real Search Console property is hardcoded", () => {
  // Must match a literal property such as "sc-domain:acme.ca" — and NOT the
  // prefix-stripping regex /^sc-domain:/ that legitimately appears in
  // lib/connections.ts and lib/google/registry.ts, nor the documented
  // placeholder "sc-domain:example.com" in a form helper.
  const REAL_PROPERTY = /sc-domain:(?!example\.)[a-z0-9-]+\.[a-z]{2,}/i;
  const offenders = productionCode()
    .filter((f) => REAL_PROPERTY.test(f.code))
    .map((f) => f.file);
  expect(offenders).toEqual([]);
});

test("that property scan can still catch a real one (guards the pattern)", () => {
  // A tightened regex is worthless if it now matches nothing at all.
  const REAL_PROPERTY = /sc-domain:(?!example\.)[a-z0-9-]+\.[a-z]{2,}/i;
  expect(REAL_PROPERTY.test('const p = "sc-domain:acme.ca";')).toBe(true);
  expect(REAL_PROPERTY.test('p.replace(/^sc-domain:/, "")')).toBe(false);
  expect(REAL_PROPERTY.test('helper="e.g. sc-domain:example.com"')).toBe(false);
});

test("no tenant contact details appear in production code", () => {
  const offenders = productionCode()
    .filter((f) => /kh\.sa62@gmail\.com|@(junkfree|pomobuild)\./i.test(f.code))
    .map((f) => f.file);
  expect(offenders).toEqual([]);
});

// ── the platform identity ──────────────────────────────────────────────────
test("the root title is the platform, not a tenant", () => {
  const src = read("app/layout.tsx");
  expect(src).toMatch(/title: PLATFORM_NAME/);
  expect(src).not.toMatch(/title: ".*—.*"/);
});

test("the platform name is declared once", () => {
  // So renaming the product is one edit rather than a search.
  const declarations = productionCode().filter((f) =>
    /export const PLATFORM_NAME/.test(f.code)
  );
  expect(declarations.map((d) => d.file)).toEqual(["lib/ui/tokens.ts"]);
});

test("a tenant title combines the brand with the platform", () => {
  expect(pageTitle("Acme Roofing")).toBe(`Acme Roofing | ${PLATFORM_NAME}`);
});

test("a missing tenant falls back to the platform name, never blank", () => {
  expect(pageTitle(undefined)).toBe(PLATFORM_NAME);
  expect(pageTitle(null)).toBe(PLATFORM_NAME);
  expect(pageTitle("")).toBe(PLATFORM_NAME);
});

test("the portal sets the tab title from the signed-in tenant", () => {
  const src = read("app/portal/PortalShell.tsx");
  expect(src).toMatch(/document\.title = pageTitle\(brand\?\.name\)/);
  // Reacts to the brand resolving, rather than running once on mount.
  expect(src).toMatch(/\}, \[brand\?\.name\]\)/);
});
