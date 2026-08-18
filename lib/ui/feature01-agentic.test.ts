// Feature 01 — policy, QA, manager selection, contracts, rollback helpers.

import { expect, test } from "vitest";
import fs from "fs";
import {
  clampConfidence,
  legacyFromMode,
  modeFromLegacy,
  MAX_QA_REVISIONS,
  isQaOutcome,
  isExecutionMode,
} from "../agents/contracts";
import { decidePolicy, resolveExecutionMode } from "../policy";
import { parseQaEvaluation, heuristicQaGate, canAutoPublishAfterQa } from "../qa";
import { selectSpecialists, parseManagerPlan, fallbackContentItems } from "../seo-manager";
import { buildRollbackChange } from "../execution/rollback";
import { prioritizeTechIssues, issueFromAuditPage } from "../technical";
import { RENDER_THRESHOLD_WORDS } from "../auditor";

test("modeFromLegacy maps auto_publish_meta correctly", () => {
  expect(modeFromLegacy(false)).toBe("approval");
  expect(modeFromLegacy(true)).toBe("hybrid");
  expect(legacyFromMode("approval")).toBe(false);
  expect(legacyFromMode("hybrid")).toBe(true);
  expect(legacyFromMode("autopilot")).toBe(true);
});

test("resolveExecutionMode prefers execution_mode column", () => {
  expect(resolveExecutionMode({ execution_mode: "autopilot", auto_publish_meta: false })).toBe("autopilot");
  expect(resolveExecutionMode({ execution_mode: null, auto_publish_meta: true })).toBe("hybrid");
  expect(resolveExecutionMode({ auto_publish_meta: false })).toBe("approval");
});

test("Approval mode never auto-executes site changes", () => {
  const d = decidePolicy({
    brandId: "a",
    mode: "approval",
    autopilotEnabled: true,
    actionType: "fix_meta",
    riskLevel: "low",
    confidence: 0.99,
    adapterAvailable: true,
    reversible: true,
    withinRunLimits: true,
    qaOutcome: "PASS",
  });
  expect(d.decision).toBe("REQUIRE_APPROVAL");
});

test("Hybrid auto-executes only safe meta fixes", () => {
  const ok = decidePolicy({
    brandId: "a",
    mode: "hybrid",
    autopilotEnabled: true,
    actionType: "fix_meta",
    riskLevel: "low",
    confidence: 0.8,
    adapterAvailable: true,
    reversible: true,
    withinRunLimits: true,
    qaOutcome: "PASS",
  });
  expect(ok.decision).toBe("AUTO_EXECUTE");

  const page = decidePolicy({
    brandId: "a",
    mode: "hybrid",
    autopilotEnabled: true,
    actionType: "new_page",
    riskLevel: "medium",
    confidence: 0.9,
    adapterAvailable: true,
    reversible: false,
    withinRunLimits: true,
    qaOutcome: "PASS",
  });
  expect(page.decision).toBe("REQUIRE_APPROVAL");
});

test("Autopilot still respects QA BLOCK and kill switch", () => {
  const blocked = decidePolicy({
    brandId: "a",
    mode: "autopilot",
    autopilotEnabled: true,
    actionType: "fix_meta",
    riskLevel: "low",
    confidence: 0.9,
    adapterAvailable: true,
    reversible: true,
    withinRunLimits: true,
    qaOutcome: "BLOCK",
  });
  expect(blocked.decision).toBe("BLOCK");

  const killed = decidePolicy({
    brandId: "a",
    mode: "autopilot",
    autopilotEnabled: false,
    actionType: "fix_meta",
    riskLevel: "low",
    confidence: 0.9,
    adapterAvailable: true,
    reversible: true,
    withinRunLimits: true,
    qaOutcome: "PASS",
  });
  expect(killed.decision).toBe("REQUIRE_APPROVAL");
});

test("run limits and duplicates block execution", () => {
  expect(
    decidePolicy({
      brandId: "a",
      mode: "autopilot",
      autopilotEnabled: true,
      actionType: "fix_meta",
      riskLevel: "low",
      confidence: 0.9,
      adapterAvailable: true,
      reversible: true,
      withinRunLimits: false,
    }).decision
  ).toBe("BLOCK");

  expect(
    decidePolicy({
      brandId: "a",
      mode: "autopilot",
      autopilotEnabled: true,
      actionType: "new_page",
      riskLevel: "medium",
      confidence: 0.9,
      adapterAvailable: true,
      reversible: false,
      withinRunLimits: true,
      duplicateSuspected: true,
    }).decision
  ).toBe("BLOCK");
});

test("QA parser rejects invalid payloads", () => {
  expect(parseQaEvaluation(null)).toBeNull();
  expect(parseQaEvaluation({ outcome: "MAYBE" })).toBeNull();
  const ok = parseQaEvaluation({
    outcome: "PASS",
    score: 88,
    issues: [],
    feedback: "Looks good",
  });
  expect(ok?.outcome).toBe("PASS");
  expect(isQaOutcome("REVISE")).toBe(true);
});

test("heuristic QA blocks thin content", () => {
  const thin = heuristicQaGate({
    title: "x",
    body: "too short",
    taskType: "new_page",
    brandName: "Acme",
    services: null,
    serviceArea: null,
  });
  expect(thin?.outcome).toBe("BLOCK");
  expect(canAutoPublishAfterQa("PASS")).toBe(true);
  expect(canAutoPublishAfterQa("BLOCK")).toBe(false);
});

test("MAX_QA_REVISIONS is bounded", () => {
  expect(MAX_QA_REVISIONS).toBe(1);
});

test("SEO Manager selects a bounded specialist set", () => {
  const sel = selectSpecialists({
    businessModel: "local_service",
    hasGsc: true,
    openDraftCount: 2,
    competitorCount: 0,
    keywordCount: 10,
    recentFindingTypes: [],
    maxItems: 3,
  });
  expect(sel.includeLocal).toBe(true);
  expect(sel.research.length).toBeLessThanOrEqual(3);
  expect(sel.contentBudget).toBeLessThanOrEqual(3);

  const fresh = selectSpecialists({
    businessModel: "saas",
    hasGsc: true,
    openDraftCount: 0,
    competitorCount: 3,
    keywordCount: 20,
    recentFindingTypes: ["organic_competitors", "keyword_strategy", "serp_blueprint", "backlink_gap"],
    maxItems: 3,
  });
  expect(fresh.research.length).toBe(0);
  expect(fresh.includeLocal).toBe(false);
});

test("Manager plan parser validates items", () => {
  expect(parseManagerPlan(null, 3)).toBeNull();
  const plan = parseManagerPlan(
    {
      objective: "Grow",
      summary: "Do meta fixes",
      items: [
        {
          capability: "content",
          objective: "Fix meta",
          task_type: "fix_meta",
          rationale: "CTR",
          risk_level: "low",
          confidence: 0.8,
        },
        { capability: "content", objective: "" },
      ],
    },
    3
  );
  expect(plan?.items.length).toBe(1);
  expect(fallbackContentItems({ striking: [{ query: "a", page: "/a" }] }, 2)[0].task_type).toBe(
    "improve_content"
  );
});

test("rollback change builder requires prior state", () => {
  expect(buildRollbackChange({ change_type: "update_meta", target: null, previous: { title: "t" } })).toBeNull();
  expect(
    buildRollbackChange({
      change_type: "update_meta",
      target: "https://x.test",
      previous: { title: "Old", metaDescription: "desc" },
    })
  ).toEqual({
    type: "update_meta",
    url: "https://x.test",
    title: "Old",
    metaDescription: "desc",
  });
  expect(
    buildRollbackChange({
      change_type: "upsert_page",
      target: "blog/x",
      previous: { title: "T" },
    })
  ).toBeNull();
});

test("technical issues are prioritized by severity then impact", () => {
  const ranked = prioritizeTechIssues([
    {
      url: "/a",
      problem: "x",
      severity: "low",
      fix: "f",
      task_type: "fix_meta",
      automatable: true,
      impact: 99,
    },
    {
      url: "/b",
      problem: "y",
      severity: "high",
      fix: "f",
      task_type: "improve_content",
      automatable: false,
      impact: 10,
    },
  ]);
  expect(ranked[0].url).toBe("/b");
});

test("issueFromAuditPage detects thin pages", () => {
  const issues = issueFromAuditPage({
    url: "https://x.test",
    status: 200,
    title: "",
    meta: "",
    h1: "",
    canonical: "",
    robots: "",
    words: Math.max(0, RENDER_THRESHOLD_WORDS - 10),
    text: "hi",
  });
  expect(issues.some((i) => i.problem.toLowerCase().includes("title"))).toBe(true);
});

test("research findings can become manager content inputs (handoff shape)", () => {
  // Collaboration contract: proposed_actions from research are consumable as
  // ManagerPlanItem task_type / keyword fields without inventing data.
  const findingAction = {
    type: "new_page" as const,
    target_keyword: "junk removal toronto",
    rationale: "Competitor gap",
    risk_level: "medium" as const,
    confidence: 0.65,
    reversible: false,
    requires_adapter: true,
  };
  const plan = parseManagerPlan(
    {
      objective: "Close gaps",
      summary: "From competitor research",
      items: [
        {
          capability: "content",
          objective: findingAction.rationale,
          task_type: findingAction.type,
          target_keyword: findingAction.target_keyword,
          rationale: findingAction.rationale,
          risk_level: findingAction.risk_level,
          confidence: findingAction.confidence,
        },
      ],
    },
    3
  );
  expect(plan?.items[0].task_type).toBe("new_page");
  expect(plan?.items[0].target_keyword).toBe("junk removal toronto");
});

test("Feature 01 keeps jobs queue as the only claimable executor", () => {
  const steps = fs.readFileSync("lib/steps.ts", "utf8");
  expect(steps).toMatch(/runSeoManager/);
  expect(steps).toMatch(/decidePolicy/);
  expect(steps).toMatch(/runQaCritic/);
  expect(fs.existsSync("lib/orchestrator.ts")).toBe(false);
  expect(isExecutionMode("hybrid")).toBe(true);
  expect(clampConfidence(2)).toBe(1);
});

test("activity and mode APIs enforce brand access helpers", () => {
  const activity = fs.readFileSync("app/api/portal/activity/route.ts", "utf8");
  expect(activity).toMatch(/requireBrandAccess/);
  const mode = fs.readFileSync("app/api/brand/[id]/mode/route.ts", "utf8");
  expect(mode).toMatch(/execution_mode/);
  expect(mode).toMatch(/requireBrandAccess/);
  const rollback = fs.readFileSync("app/api/execution/rollback/route.ts", "utf8");
  expect(rollback).toMatch(/requireBrandAccess/);
  expect(rollback).toMatch(/rollbackExecution/);
});

test("migration 013 is brand-scoped and service-role only", () => {
  const sql = fs.readFileSync("supabase/013_agentic_seo_team.sql", "utf8");
  expect(sql).toMatch(/agent_tasks/);
  expect(sql).toMatch(/agent_findings/);
  expect(sql).toMatch(/agent_qa_results/);
  expect(sql).toMatch(/agent_activity/);
  expect(sql).toMatch(/execution_mode/);
  expect(sql).toMatch(/brand_id uuid not null references brands/);
  expect(sql).toMatch(/revoke all on table agent_tasks from anon, authenticated/);
  expect(sql).toMatch(/grant all privileges on table agent_tasks to service_role/);
});
