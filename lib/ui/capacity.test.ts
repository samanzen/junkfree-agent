import { test, expect } from "vitest";
import { PLAN_CAPACITY, canUse, quotaFor, resolvePlan } from "../capabilities";
import fs from "fs";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

test("plans are sold as execution capacity, not toolkit SKUs", () => {
  for (const key of ["founding", "growth", "managed"] as const) {
    const p = PLAN_CAPACITY[key];
    expect(p.quotas.tracked_keywords).toBeGreaterThan(100);
    expect(p.quotas.ai_prompts).toBeGreaterThan(10);
    expect(p.quotas.agent_runs_per_day).toBeGreaterThan(0);
    expect(p.capabilities.ai_visibility_tracking).toBe(true);
    expect(p.capabilities.review_automation).toBe(true);
  }
  expect(quotaFor({ plan: "growth" }, "tracked_keywords")).toBeGreaterThan(
    quotaFor({ plan: "founding" }, "tracked_keywords")
  );
  expect(resolvePlan({})).toBe("founding");
  expect(canUse({}, "conversion_signals")).toBe(true);
});

test("pricing page sells capacity against Semrush toolkits", () => {
  const src = read("app/pricing/page.tsx");
  expect(src).toMatch(/PLAN_CAPACITY/);
  expect(src).toMatch(/execution capacity/i);
  expect(src).toMatch(/AI visibility prompts/);
  expect(src).toMatch(/agent runs/i);
});

test("AI visibility portal + API exist", () => {
  expect(fs.existsSync(`${ROOT}/app/portal/ai-visibility/page.tsx`)).toBe(true);
  expect(read("app/portal/nav.ts")).toMatch(/\/portal\/ai-visibility/);
  expect(read("app/api/portal/ai-visibility/route.ts")).toMatch(/checkAiVisibilitySuite/);
  expect(read("lib/geo-agent.ts")).toMatch(/checkAiVisibilitySuite/);
});

test("review automation is wired into the job loop", () => {
  expect(read("lib/queue.ts")).toMatch(/"reviews"/);
  expect(read("lib/steps.ts")).toMatch(/stepReviews/);
  expect(read("lib/steps.ts")).toMatch(/draftReviewResponse/);
  expect(read("lib/google/gbp.ts")).toMatch(/listGbpReviews/);
});

test("conversion signals unlock when GA4 is connected", () => {
  expect(read("lib/conversions.ts")).toMatch(/captureConversionSignals/);
  expect(read("lib/google/ga4.ts")).toMatch(/fetchGa4Conversions/);
  expect(read("app/api/portal/summary/route.ts")).toMatch(/conversion_signals/);
  expect(read("app/portal/page.tsx")).toMatch(/Connect Google Analytics/);
});

test("migration 015 ships the capacity schema", () => {
  const sql = read("supabase/015_execution_capacity.sql");
  expect(sql).toMatch(/NOT YET APPLIED/);
  expect(sql).toMatch(/ai_visibility_prompts/);
  expect(sql).toMatch(/ai_visibility_checks/);
  expect(sql).toMatch(/conversion_signals/);
  expect(sql).toMatch(/add column if not exists plan/);
});
