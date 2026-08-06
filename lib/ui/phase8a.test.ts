// Phase 8A: activation of already-written AI.
//
// Each test guards a connection, not a feature. The failure mode being
// prevented is the one the capability audit found: an agent that exists, works,
// and has no caller — which nothing in the suite would otherwise notice.

import fs from "fs";
import { test, expect } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(`${ROOT}/${dir}`, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

/** Files that call `name`, excluding the module that defines it. */
function callersOf(name: string, definedIn: string): string[] {
  return [...walk("lib"), ...walk("app")]
    .filter((f) => f !== definedIn)
    .filter((f) => new RegExp(`\\b${name}\\s*\\(`).test(read(f)));
}

// ── SERP blueprint → content generation ─────────────────────────────────────
test("serpBlueprint has a caller", () => {
  expect(callersOf("serpBlueprint", "lib/intelligence.ts").length).toBeGreaterThan(0);
});

test("content generation consumes the blueprint", () => {
  const src = read("lib/agents/index.ts");
  expect(src).toContain("serpBlueprint");
  // The blueprint's fields must actually reach the prompt, not just be fetched.
  for (const field of ["dominant_angle", "must_cover", "gaps_to_exploit", "recommended_h2s"]) {
    expect(src).toContain(field);
  }
});

test("content generation still works when the blueprint is unavailable", () => {
  // The whole wiring must degrade to the previous behaviour rather than fail
  // a content job, since DataForSEO and the extra model call can both fail.
  const src = read("lib/agents/index.ts");
  expect(src).toMatch(/serpBlueprint\([^)]*\)\s*\.catch\(\(\) => null\)/);
  expect(src).toMatch(/blueprint\s*\?/);
});

test("the depth instruction defers to the blueprint instead of contradicting it", () => {
  // The prompt used to hardcode 1200-1800 words; with a measured target from
  // the SERP that would be two conflicting instructions in one prompt.
  const src = read("lib/agents/index.ts");
  expect(src).toMatch(/blueprint\?\.target_depth_words \?/);
});

// ── AI visibility → metric snapshots ────────────────────────────────────────
test("checkAiVisibility has a caller", () => {
  expect(callersOf("checkAiVisibility", "lib/geo-agent.ts").length).toBeGreaterThan(0);
});

test("ai_visibility is no longer hardcoded null", () => {
  const src = read("lib/metrics.ts");
  expect(src).not.toMatch(/ai_visibility:\s*null,/);
  expect(src).toMatch(/ai_visibility:\s*aiVisibility/);
});

test("a failed visibility check leaves the column null rather than failing the snapshot", () => {
  expect(read("lib/metrics.ts")).toMatch(/checkAiVisibility\(brand\)[\s\S]{0,120}\.catch\(\(\) => null\)/);
});

test("the AI visibility card explains what its number means", () => {
  // 100/0 is a yes/no. Displayed without wording it reads as a percentage.
  const src = read("app/portal/page.tsx");
  expect(src).not.toMatch(/label="AI Visibility"[\s\S]{0,80}hint="Coming soon"/);
  expect(src).toMatch(/AI assistants recommend you/);
});

// ── llms.txt → route ────────────────────────────────────────────────────────
test("buildLlmsTxt has a caller", () => {
  expect(callersOf("buildLlmsTxt", "lib/geo-agent.ts").length).toBeGreaterThan(0);
});

test("the llms.txt route reuses the existing generator rather than reimplementing it", () => {
  const src = read("app/api/portal/llms-txt/route.ts");
  expect(src).toContain("buildLlmsTxt");
  // No template literal rebuilding the file body in the route.
  expect(src).not.toMatch(/## Services/);
});

test("the llms.txt route is brand-scoped and authenticated", () => {
  const src = read("app/api/portal/llms-txt/route.ts");
  expect(src).toContain("requireAuth");
  expect(src).toContain("requireBrandAccess");
});

test("llms.txt is served as plain text", () => {
  expect(read("app/api/portal/llms-txt/route.ts")).toMatch(/text\/plain/);
});

test("the portal fetches llms.txt with credentials, not a bare link", () => {
  // A plain <a> would navigate without the bearer token the portal holds in
  // localStorage, and requireAuth would reject it.
  const src = read("app/portal/technical/_LlmsTxtPanel.tsx");
  expect(src).toContain("authedFetch");
  expect(src).not.toMatch(/<a[^>]+href=\{`\/api\/portal\/llms-txt/);
});
