// Phase 6: design-system consistency.
//
// Two kinds of check here. The token checks assert the shared scales exist and
// are actually referenced. The structural checks exist because this phase was
// largely mechanical rewrites of CSS inside template literals, and a bad
// substitution there fails silently — a selector list that never reaches a "{"
// simply swallows the next rule, and the build still succeeds.

import fs from "fs";
import { test, expect } from "vitest";
import { GLOBAL_CSS } from "./tokens";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

const STYLESHEETS = [
  "app/portal/portalTheme.ts",
  "app/dashboard/page.tsx",
  "app/dashboard/intelligence/IntelligencePage.tsx",
  "app/login/page.tsx",
  "app/_components/Notify.tsx",
  "lib/ui/tokens.ts",
];

// ── Token scales exist ──────────────────────────────────────────────────────
test("radius scale is defined once, globally", () => {
  for (const t of ["--radius-xs:", "--radius-sm:", "--radius-md:", "--radius-lg:", "--radius-full:"]) {
    expect(GLOBAL_CSS).toContain(t);
  }
});

test("elevation scale is defined once, globally", () => {
  for (const t of ["--shadow-1:", "--shadow-2:", "--shadow-3:", "--shadow-4:"]) {
    expect(GLOBAL_CSS).toContain(t);
  }
});

test("type scale defines sizes and weights", () => {
  for (const t of ["--fz-caption:", "--fz-small:", "--fz-body:", "--fz-lead:", "--fz-h1:"]) {
    expect(GLOBAL_CSS).toContain(t);
  }
  for (const t of ["--fw-medium:", "--fw-semi:", "--fw-bold:"]) {
    expect(GLOBAL_CSS).toContain(t);
  }
});

test("spacing scale covers the intended steps", () => {
  for (const v of ["4px", "8px", "12px", "16px", "24px", "32px", "48px"]) {
    expect(GLOBAL_CSS).toContain(v);
  }
});

// ── Font weights collapsed ──────────────────────────────────────────────────
test("font weights are limited to the five in the scale", () => {
  const allowed = new Set(["400", "500", "600", "660", "700", "720"]);
  const strays = new Set<string>();
  for (const f of STYLESHEETS) {
    for (const m of read(f).matchAll(/font-weight:(\d+)/g)) {
      if (!allowed.has(m[1])) strays.add(`${f}: ${m[1]}`);
    }
  }
  expect([...strays]).toEqual([]);
});

// ── Elevation and radius are tokenised outside the portal ───────────────────
test("surfaces without their own scale reference the shared elevation tokens", () => {
  // The portal keeps its --sh-* scale (which has light AND dark variants);
  // rewriting it would be churn with no visual change. Everything else uses
  // the shared tokens.
  const strays: string[] = [];
  for (const f of ["app/dashboard/page.tsx", "app/login/page.tsx"]) {
    for (const m of read(f).matchAll(/box-shadow:([^;]+);/g)) {
      const v = m[1];
      if (/rgba\(16,24,40/.test(v)) strays.push(`${f}: ${v.slice(0, 40)}`);
    }
  }
  expect(strays).toEqual([]);
});

test("surface radii are tokenised across every stylesheet", () => {
  // 2–5px are hairline details (progress-bar tracks, 3px accent strips), not
  // surfaces. 13px and 17px in the portal sit 2px from any step in its scale
  // and were left alone rather than nudged — same conservative rule used for
  // spacing, where a >1px shift could undo a deliberate optical adjustment.
  const allowed = new Set([13, 17]);
  const strays: string[] = [];
  for (const f of STYLESHEETS) {
    for (const m of read(f).matchAll(/border-radius:(\d+)px/g)) {
      const px = +m[1];
      if (px > 5 && !allowed.has(px)) strays.push(`${f}: ${px}px`);
    }
  }
  expect(strays).toEqual([]);
});

test("no multi-value radius mixes a token with a literal", () => {
  // Half-replacing a shorthand like "14px 14px 0 0" leaves mismatched corners.
  // This happened during Phase 6 and was only visible on close inspection.
  const strays: string[] = [];
  for (const f of STYLESHEETS) {
    for (const m of read(f).matchAll(/border-radius:var\(--radius[a-z-]*\)\s+\d+px/g)) {
      strays.push(`${f}: ${m[0]}`);
    }
  }
  expect(strays).toEqual([]);
});

// ── Structural integrity ────────────────────────────────────────────────────
function cssBlocks(src: string): string[] {
  return (src.match(/`[\s\S]*?`/g) || []).filter((b) => b.length > 200 && /[{};]/.test(b));
}

test("every stylesheet has balanced braces", () => {
  const bad: string[] = [];
  for (const f of STYLESHEETS) {
    for (const b of cssBlocks(read(f))) {
      const open = (b.match(/\{/g) || []).length;
      const close = (b.match(/\}/g) || []).length;
      if (open !== close) bad.push(`${f}: {${open}} }${close}`);
    }
  }
  expect(bad).toEqual([]);
});

test("no selector list is left dangling without a declaration block", () => {
  // The failure mode: a merged selector list whose terminating rule was
  // deleted. The selectors then swallow whatever rule follows, and nothing
  // errors — the build succeeds and the page silently loses styling.
  const bad: string[] = [];
  for (const f of STYLESHEETS) {
    for (const b of cssBlocks(read(f))) {
      const lines = b.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        if (/,\s*$/.test(lines[i]) && /^\s*(\/\*|@|$)/.test(lines[i + 1])) {
          bad.push(`${f}: ${lines[i].trim().slice(0, 50)}`);
        }
      }
    }
  }
  expect(bad).toEqual([]);
});

// ── De-duplication held ─────────────────────────────────────────────────────
test("the identical intelligence placeholders are declared once", () => {
  const src = read("app/dashboard/intelligence/IntelligencePage.tsx");
  const decl = "padding:40px; text-align:center; color:#9AA3B2; font-size:13px;";
  const count = src.split(decl).length - 1;
  expect(count).toBe(1);
});

test("placeholders whose padding is container-specific stay separate", () => {
  // Merging these would be a layout change, not de-duplication.
  const src = read("app/dashboard/intelligence/IntelligencePage.tsx");
  expect(src).toMatch(/\.kd-loading,\.kd-empty \{ padding:40px 20px/);
  expect(src).toMatch(/\.cp-empty \{ padding:30px/);
  expect(src).toMatch(/\.io-empty \{ text-align:center; padding:60px 20px/);
});
