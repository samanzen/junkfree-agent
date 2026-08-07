// Phase 8B: JavaScript rendering in the crawler.
//
// The defect being guarded: the crawler reads raw HTML, so a client-rendered
// site returns its pre-JS shell. Measured on junkfree.ca, 12 of 12 sampled
// pages yielded exactly 10 words and no H1 — a 100% false thin-content rate.
//
// These tests pin the two properties that make the fix safe rather than just
// present: rendering is opt-in (so no existing path silently starts paying a
// metered call), and every failure degrades to the previous behaviour.

import fs from "fs";
import { test, expect } from "vitest";
import { canUse } from "../capabilities";
import { RENDER_THRESHOLD_WORDS } from "../auditor";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

// ── the rendering call reuses the existing client ───────────────────────────
test("rendering goes through the existing DataForSEO client", () => {
  // A second fetch with its own auth would duplicate the client and drift from
  // it. renderedPageContent must use the shared post() helper.
  const src = read("lib/dataforseo.ts");
  expect(src).toMatch(/export async function renderedPageContent/);
  expect(src).toMatch(/post<Task<unknown>>\("\/on_page\/content_parsing\/live"/);
  // No bespoke fetch inside the new function.
  const fn = src.slice(src.indexOf("export async function renderedPageContent"));
  expect(fn.slice(0, fn.indexOf("\n}"))).not.toMatch(/fetch\(/);
});

test("rendering is requested explicitly", () => {
  // enable_javascript is the entire point: with it false the endpoint returns
  // 0 words, reproducing the crawler's own failure.
  expect(read("lib/dataforseo.ts")).toMatch(/enable_javascript: true/);
});

// ── opt-in, so nothing silently starts spending ─────────────────────────────
test("inspectPage does not render unless asked", () => {
  const src = read("lib/auditor.ts");
  expect(src).toMatch(/opts: \{ render\?: boolean \} = \{\}/);
  // The render branch requires BOTH the opt-in and a short page.
  expect(src).toMatch(/opts\.render && text\.split\(" "\)\.length < RENDER_THRESHOLD_WORDS/);
});

test("a failed render leaves the raw-HTML result intact", () => {
  // Rendering may only add information. It must never fail a crawl.
  const src = read("lib/auditor.ts");
  expect(src).toMatch(/renderedPageContent\(url\)\.catch\(\(\) => null\)/);
  expect(src).toMatch(/if \(rendered\?\.text\)/);
});

test("auditSite threads the option through instead of deciding for itself", () => {
  const src = read("lib/auditor.ts");
  expect(src).toMatch(/export async function auditSite\(brand: Brand, sampleSize = 12, opts/);
  expect(src).toMatch(/sample\.map\(\(u\) => inspectPage\(u, opts\)\)/);
});

// ── the tier seam ───────────────────────────────────────────────────────────
test("both call sites ask the capability gate rather than hardcoding true", () => {
  // This is what lets a plan tier turn rendering off later without touching
  // the crawl or content logic.
  const src = read("lib/steps.ts");
  const asks = src.match(/canUse\(brand, "js_rendering"\)/g) || [];
  expect(asks.length).toBe(2); // stepAudit + improve_content
});

test("the capability gate is a decision point, not billing logic", () => {
  // Deliberately no plans or prices yet — only the seam. Checked against the
  // code with comments stripped, since the file's own prose says "no prices".
  const code = read("lib/capabilities.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  expect(code).not.toMatch(/stripe|price|invoice|subscription_id/i);
  expect(canUse({ slug: "any-brand" }, "js_rendering")).toBe(true);
});

// ── the shared threshold ────────────────────────────────────────────────────
test("one threshold defines 'too thin to be real' platform-wide", () => {
  expect(RENDER_THRESHOLD_WORDS).toBe(100);
  // steps.ts must import it rather than redeclare its own number.
  const src = read("lib/steps.ts");
  expect(src).toMatch(/RENDER_THRESHOLD_WORDS/);
  expect(src).not.toMatch(/const MIN_READABLE_WORDS/);
});

// ── the dead module is gone ─────────────────────────────────────────────────
test("the deprecated orchestrator is deleted, not just unused", () => {
  // It duplicated the queue's planning logic and still carried the
  // auditPage(brand, kw, "") bug fixed in Phase 8A.
  expect(fs.existsSync(`${ROOT}/lib/orchestrator.ts`)).toBe(false);
});
