// Phase 5: motion vocabulary, accessibility and contrast.
//
// The contrast checks below compute real WCAG ratios from the declared
// palettes, so a future colour tweak that drops a token under threshold fails
// here rather than shipping.

import fs from "fs";
import { test, expect } from "vitest";
import { GLOBAL_CSS, MOTION, touchTargetCSS } from "./tokens";
import { PORTAL_CSS } from "@/app/portal/portalTheme";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");
const DASH = read("app/dashboard/page.tsx");

// ── Motion vocabulary ───────────────────────────────────────────────────────
test("four durations and two curves are defined once, globally", () => {
  for (const d of ["--dur-1:120ms", "--dur-2:180ms", "--dur-3:280ms", "--dur-4:420ms"]) {
    expect(GLOBAL_CSS).toContain(d);
  }
  expect(GLOBAL_CSS).toContain("--ease-out:cubic-bezier(.16,1,.3,1)");
  expect(GLOBAL_CSS).toContain("--ease-inout:cubic-bezier(.32,.72,0,1)");
});

test("the JS vocabulary matches the CSS curve exactly", () => {
  // If these drift, a CSS transition and a Framer animation on the same
  // element move differently — the exact bug the shared vocabulary prevents.
  expect(MOTION.ease).toEqual([0.16, 1, 0.3, 1]);
  expect(GLOBAL_CSS).toContain(`--ease-out:cubic-bezier(${MOTION.ease.join(",").replace(/0\./g, ".")})`);
});

test("every CSS transition uses a duration token, not a literal", () => {
  const files = [
    "app/portal/portalTheme.ts", "app/dashboard/page.tsx", "app/login/page.tsx",
    "app/dashboard/intelligence/IntelligencePage.tsx", "app/_components/Notify.tsx",
  ];
  const strays: string[] = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/transition:[^;]+;/g)) {
      if (/[\s:]\.?\d+m?s\b/.test(m[0])) strays.push(`${f}: ${m[0].slice(0, 60)}`);
    }
  }
  expect(strays).toEqual([]);
});

test("Framer durations are limited to the four shared steps", () => {
  const steps = [MOTION.fast, MOTION.base, MOTION.surface, MOTION.entrance].map(String);
  const strays: string[] = [];
  function walk(dir: string) {
    for (const e of fs.readdirSync(`${ROOT}/${dir}`, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".tsx")) {
        for (const m of read(p).matchAll(/duration: (0\.\d+)/g)) {
          if (!steps.includes(m[1])) strays.push(`${p}: ${m[1]}`);
        }
      }
    }
  }
  walk("app");
  expect(strays).toEqual([]);
});

test("reduced motion still neutralises everything, once", () => {
  expect(GLOBAL_CSS).toMatch(/@media \(prefers-reduced-motion:reduce\)/);
  expect(PORTAL_CSS).not.toMatch(/prefers-reduced-motion/);
});

// ── Focus and keyboard ──────────────────────────────────────────────────────
test("every surface gets a visible focus ring", () => {
  for (const scope of [".portal", ".sr", ".lg"]) {
    expect(touchTargetCSS(scope)).toContain(`${scope} :focus-visible`);
  }
});

test("focus rings use :focus-visible, not :focus", () => {
  const css = touchTargetCSS(".sr");
  expect(css).toMatch(/:focus-visible \{[^}]*outline:2px/);
  expect(css).not.toMatch(/\.sr :focus \{/);
});

test("a skip link exists and is only visible when focused", () => {
  expect(touchTargetCSS(".sr")).toMatch(/\.skip-link \{[\s\S]*?top:-60px/);
  expect(touchTargetCSS(".sr")).toMatch(/\.skip-link:focus \{ top:12px/);
  expect(DASH).toContain('href="#dash-main" className="skip-link"');
});

/**
 * Opening tags for the given elements, each as its exact source text.
 *
 * Written as a scanner rather than a regex because JSX defeats both obvious
 * patterns: `[^>]*` stops at the ">" inside an arrow function, and a fixed
 * character window picks up a child element's attributes. Tracking brace depth
 * makes the tag boundary exact — the first ">" seen outside any {…}.
 */
function openingTags(src: string, names: string[]): string[] {
  const out: string[] = [];
  const re = new RegExp(`<(${names.join("|")})\\b`, "g");
  for (const m of src.matchAll(re)) {
    let depth = 0;
    for (let i = m.index!; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) { out.push(src.slice(m.index!, i + 1)); break; }
    }
  }
  return out;
}

test("no clickable element is left unreachable by keyboard", () => {
  const strays: string[] = [];
  function walk(dir: string) {
    for (const e of fs.readdirSync(`${ROOT}/${dir}`, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".tsx")) {
        for (const tag of openingTags(read(p), ["div", "span", "tr"])) {
          if (!/onClick=/.test(tag)) continue;
          // Either it handles keys itself, or it is decorative (a scrim the
          // dialog already dismisses), or it declares itself a button and
          // carries the keyboard handling that implies.
          if (/onKeyDown|aria-hidden/.test(tag)) continue;
          strays.push(`${p}: ${tag.slice(0, 70).replace(/\s+/g, " ")}`);
        }
      }
    }
  }
  walk("app");
  expect(strays).toEqual([]);
});

test("sortable headers are buttons and report their sort direction", () => {
  const kt = read("app/dashboard/intelligence/KeywordTable.tsx");
  expect(kt).toMatch(/aria-sort=\{active \? \(order === "desc" \? "descending" : "ascending"\) : "none"\}/);
  expect(kt).toMatch(/<button type="button" className="kt-sort"/);
});

// ── Landmarks ───────────────────────────────────────────────────────────────
test("every top-level surface exposes a main landmark", () => {
  expect(DASH).toContain('<main id="dash-main"');
  expect(read("app/login/page.tsx")).toContain("<main className=\"card\">");
  expect(read("app/portal/PortalShell.tsx")).toContain('<main className="p-main">');
});

// ── Contrast ────────────────────────────────────────────────────────────────
function lum(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function varsIn(src: string, marker: string): Record<string, string> {
  const block = src.slice(src.indexOf(marker), src.indexOf(marker) + 3000);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}

const light = varsIn(PORTAL_CSS, ".portal {");
const dark = varsIn(PORTAL_CSS, "color-scheme: dark");
const admin = varsIn(DASH, ".sr {");

test("portal light: every text colour clears 4.5:1 on surface", () => {
  const fails: string[] = [];
  for (const k of ["text", "text2", "muted", "muted2", "accent", "green", "amber", "red", "blue", "pink"]) {
    const r = ratio(light[k], light.surface);
    if (r < 4.5) fails.push(`--${k} ${r.toFixed(2)}:1`);
  }
  expect(fails).toEqual([]);
});

test("portal dark: every text colour clears 4.5:1 on surface", () => {
  const fails: string[] = [];
  for (const k of ["text", "text2", "muted", "muted2", "accent", "green", "amber", "red", "blue", "pink"]) {
    const r = ratio(dark[k], dark.surface);
    if (r < 4.5) fails.push(`--${k} ${r.toFixed(2)}:1`);
  }
  expect(fails).toEqual([]);
});

test("admin: every text colour clears 4.5:1 on surface", () => {
  const fails: string[] = [];
  for (const k of ["text", "muted", "accent", "green", "amber", "coral", "violet"]) {
    const r = ratio(admin[k], admin.surface);
    if (r < 4.5) fails.push(`--${k} ${r.toFixed(2)}:1`);
  }
  expect(fails).toEqual([]);
});

test("focus rings clear the 3:1 non-text threshold", () => {
  expect(ratio(light.accent, light.bg)).toBeGreaterThanOrEqual(3);
  expect(ratio(dark.accent, dark.bg)).toBeGreaterThanOrEqual(3);
  expect(ratio(admin.accent, admin.bg)).toBeGreaterThanOrEqual(3);
});
