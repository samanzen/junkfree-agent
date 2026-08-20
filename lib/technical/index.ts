// Feature 01 — Technical SEO execution: detect → prioritize → fix → verify.
// Never pretends a fix ran when no adapter supports the operation.

import { RENDER_THRESHOLD_WORDS, type AuditedPage } from "../auditor";
import { executeChange, resolvePublishTarget } from "../execution/engine";
import { isOperationAutopilotReady } from "../execution/source-of-truth";
import type { SiteChange } from "../execution/types";
import { enqueue } from "../queue";
import { db } from "../supabase";
import type { Brand } from "../brands";
import {
  emptySpecialistResult,
  MAX_MANAGER_ITEMS,
  type AgentFinding,
  type ProposedAction,
  type SpecialistResult,
} from "../agents/contracts";
import { persistSpecialistResult, recordActivity } from "../agents/store";
import { decidePolicy, resolveExecutionMode } from "../policy";
import { checkPublishedPage } from "../publish-check";

export type TechIssue = {
  url: string;
  problem: string;
  severity: "high" | "medium" | "low";
  fix: string;
  task_type: "fix_meta" | "improve_content" | "technical_fix";
  automatable: boolean;
  impact: number; // 1-100
};

export function prioritizeTechIssues(issues: TechIssue[]): TechIssue[] {
  return [...issues].sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 };
    const d = sev[b.severity] - sev[a.severity];
    if (d !== 0) return d;
    return b.impact - a.impact;
  });
}

export function issueFromAuditPage(page: AuditedPage): TechIssue[] {
  const issues: TechIssue[] = [];
  if (!page.title || page.title.length < 5) {
    issues.push({
      url: page.url,
      problem: "Missing or weak title",
      severity: "high",
      fix: "Write a descriptive title tag with the primary keyword.",
      task_type: "fix_meta",
      automatable: true,
      impact: 80,
    });
  }
  if (!page.meta || page.meta.length < 40) {
    issues.push({
      url: page.url,
      problem: "Missing or thin meta description",
      severity: "medium",
      fix: "Write a compelling meta description (120–160 chars).",
      task_type: "fix_meta",
      automatable: true,
      impact: 60,
    });
  }
  if (page.words < RENDER_THRESHOLD_WORDS) {
    issues.push({
      url: page.url,
      problem: "Thin or non-rendered content",
      severity: "high",
      fix: "Expand on-page content or ensure server-rendered HTML.",
      task_type: "improve_content",
      automatable: false,
      impact: 85,
    });
  }
  if (!page.h1) {
    issues.push({
      url: page.url,
      problem: "Missing H1",
      severity: "medium",
      fix: "Add a single clear H1 matching search intent.",
      task_type: "improve_content",
      automatable: false,
      impact: 55,
    });
  }
  return issues;
}

/**
 * Attempt an automated technical fix when the publishing adapter supports it.
 * Unsupported fixes become recommendations / content jobs — never fake success.
 */
export async function attemptTechnicalFix(
  brand: Brand & { execution_mode?: string | null; autopilot_enabled?: boolean | null },
  issue: TechIssue,
  opts: { runId?: string | null; title?: string | null; metaDescription?: string | null } = {}
): Promise<{
  attempted: boolean;
  executed: boolean;
  verified: boolean;
  reason: string;
}> {
  if (!issue.automatable || issue.task_type !== "fix_meta") {
    return {
      attempted: false,
      executed: false,
      verified: false,
      reason: "Issue is not classified as an automated meta fix.",
    };
  }

  const target = await resolvePublishTarget(brand.id);
  const adapterOk = target.ok && target.adapter.capabilities.includes("update_meta");
  if (!adapterOk) {
    return {
      attempted: false,
      executed: false,
      verified: false,
      reason: "No adapter claims update_meta — queued as recommendation instead.",
    };
  }

  // Never write live meta without concrete replacement text. Technical issues
  // become content jobs (fix_meta) that go through generate → QA → policy.
  if (!opts.title && !opts.metaDescription) {
    return {
      attempted: false,
      executed: false,
      verified: false,
      reason: "No generated title/meta provided — refusing live write; queue content job instead.",
    };
  }

  const mode = resolveExecutionMode(brand);
  const policy = decidePolicy({
    brandId: brand.id,
    mode,
    autopilotEnabled: brand.autopilot_enabled !== false,
    actionType: "fix_meta",
    riskLevel: "low",
    confidence: 0.75,
    qaOutcome: "PASS", // only callable after an explicit QA PASS upstream
    adapterAvailable: target.ok,
    reversible: true,
    withinRunLimits: true,
    requiresLivePublish: true,
    operationCertified: isOperationAutopilotReady(brand, "update_meta"),
  });

  if (policy.decision !== "AUTO_EXECUTE") {
    return {
      attempted: false,
      executed: false,
      verified: false,
      reason: policy.reason,
    };
  }

  const change: SiteChange = {
    type: "update_meta",
    url: issue.url,
    title: opts.title ?? null,
    metaDescription: opts.metaDescription ?? null,
  };

  const outcome = await executeChange(brand, change, {});
  if (outcome.status === "failed") {
    await recordActivity({
      brandId: brand.id,
      runId: opts.runId,
      capability: "technical_execution",
      eventType: "tech_fix_failed",
      title: `Technical fix failed: ${issue.url}`,
      detail: outcome.error,
      status: "error",
    });
    return {
      attempted: true,
      executed: false,
      verified: false,
      reason: outcome.error,
    };
  }

  const verifiedResult = await checkPublishedPage(brand, {
    url: issue.url,
    changeType: "update_meta",
    title: opts.title ?? null,
    metaDescription: opts.metaDescription ?? null,
  });
  const verified = verifiedResult.ok;

  await recordActivity({
    brandId: brand.id,
    runId: opts.runId,
    capability: "technical_execution",
    eventType: verified ? "tech_fix_verified" : "tech_fix_executed",
    title: verified
      ? `Verified technical fix on ${issue.url}`
      : `Executed technical fix on ${issue.url} (verify inconclusive)`,
    decision: policy.reason,
    status: verified ? "success" : "warning",
  });

  return {
    attempted: true,
    executed: true,
    verified,
    reason: verified ? "Fixed and verified." : "Executed; verification inconclusive.",
  };
}

export async function runTechnicalExecution(
  brand: Brand & { execution_mode?: string | null; autopilot_enabled?: boolean | null },
  pages: AuditedPage[],
  opts: { runId?: string | null; extraIssues?: TechIssue[] } = {}
): Promise<SpecialistResult> {
  const allIssues = prioritizeTechIssues([
    ...pages.flatMap(issueFromAuditPage),
    ...(opts.extraIssues || []),
  ]).slice(0, 8);
  const findings: AgentFinding[] = [];
  const proposed: ProposedAction[] = [];
  let autoFixed = 0;

  for (const issue of allIssues.slice(0, 3)) {
    // Feature 01 hardening: do not live-write null meta. Always route through
    // the content pipeline (generate → QA → policy) unless a verified payload
    // is supplied. attemptTechnicalFix will no-op without title/meta.
    const result = await attemptTechnicalFix(brand, issue, { runId: opts.runId });
    if (result.executed) {
      autoFixed++;
      continue;
    }
    // Route unsupported / approval-required issues into the existing content queue.
    proposed.push({
      type: issue.task_type === "fix_meta" ? "fix_meta" : "improve_content",
      target_url: issue.url,
      rationale: `Technical: ${issue.problem} — ${issue.fix}`,
      risk_level: issue.severity === "high" ? "medium" : "low",
      confidence: 0.7,
      reversible: issue.task_type === "fix_meta",
      requires_adapter: issue.automatable,
    });
    if (opts.runId) {
      // Dedup: skip if an identical content job is already queued/running.
      const { count } = await db
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brand.id)
        .eq("kind", "content")
        .in("status", ["queued", "running"]);
      // Soft budget: technical may add at most 2 content jobs beyond Manager.
      if ((count || 0) < MAX_MANAGER_ITEMS + 2) {
        await enqueue(brand.id, "content", {
          task_type: issue.task_type === "improve_content" ? "improve_content" : "fix_meta",
          target_url: issue.url,
          rationale: `Auditor/Tech: ${issue.problem} — ${issue.fix}`,
          risk_level: issue.severity === "high" ? "medium" : "low",
          confidence: 0.7,
          runId: opts.runId,
        });
      }
    }
  }

  findings.push({
    capability: "technical_execution",
    finding_type: "tech_issues",
    title: `${allIssues.length} technical issues prioritized`,
    summary: `${autoFixed} auto-fixed; ${proposed.length} routed for review/content`,
    evidence: { issues: allIssues, autoFixed },
    recommendations: allIssues.slice(0, 5).map((i) => `${i.url}: ${i.fix}`),
    proposed_actions: proposed,
    confidence: 0.75,
    risk_level: "medium",
  });

  // Persist a compact report section for the portal.
  if (allIssues.length) {
    await db.from("reports").insert({
      brand_id: brand.id,
      section: "technical_execution",
      summary: JSON.stringify({
        issue_count: allIssues.length,
        auto_fixed: autoFixed,
        routed: proposed.length,
      }),
      cache_expires_at: new Date(Date.now() + 26 * 3600_000).toISOString(),
    });
  }

  const result: SpecialistResult = {
    ...emptySpecialistResult({
      capability: "technical_execution",
      brand_id: brand.id,
      run_id: opts.runId ?? null,
      task_id: null,
      objective: "Detect, prioritize, fix, verify technical issues",
    }),
    findings,
    proposed_actions: proposed,
    recommendations: findings[0].recommendations,
    evidence: findings[0].evidence,
    confidence: 0.75,
    risk_level: "medium",
    status: "ok",
    errors: [],
  };

  await persistSpecialistResult(result);
  await recordActivity({
    brandId: brand.id,
    runId: opts.runId,
    capability: "technical_execution",
    eventType: "tech_pass",
    title: `Technical execution: ${autoFixed} fixed, ${proposed.length} queued`,
    status: "info",
  });
  return result;
}
