// Feature 01 — SEO Manager.
// Coordinates specialists with bounded delegation. Hooks into stepPlan;
// does not replace the jobs queue.

import { callClaude, extractJSON } from "../anthropic";
import { brandBlock, isLocalBusiness, type Brand } from "../brands";
import { strikingDistance, lowCtrPages } from "../gsc";
import { activeLessons } from "../learning";
import { enqueue } from "../queue";
import { db } from "../supabase";
import type { TaskType } from "../supabase";
import {
  MAX_MANAGER_ITEMS,
  clampConfidence,
  normalizeRisk,
  type AgentCapability,
  type ManagerPlan,
  type ManagerPlanItem,
  type ProposedActionType,
  type RiskLevel,
} from "../agents/contracts";
import { buildSharedContext, contextPromptBlock } from "../agents/context";
import {
  createAgentTask,
  recordActivity,
  updateAgentTask,
} from "../agents/store";
import {
  runCompetitorResearch,
  runKeywordIntentStrategy,
  runSerpResearch,
} from "../agents/research";
import { runAuthorityResearch } from "../authority";

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

const CONTENT_TYPES = new Set(["fix_meta", "improve_content", "new_page", "new_blog"]);

function asTaskType(v: string | undefined): TaskType | null {
  if (!v) return null;
  return CONTENT_TYPES.has(v) ? (v as TaskType) : null;
}

export function selectSpecialists(input: {
  businessModel: string;
  hasGsc: boolean;
  openDraftCount: number;
  competitorCount: number;
  keywordCount: number;
  recentFindingTypes: string[];
  maxItems: number;
}): { research: AgentCapability[]; contentBudget: number; includeGeo: boolean; includeLocal: boolean; includeAudit: boolean; includeAuthority: boolean; includePerformance: boolean } {
  const research: AgentCapability[] = [];
  const fresh = new Set(input.recentFindingTypes);

  // Prefer reusing fresh findings; only schedule research when stale/missing.
  if (!fresh.has("organic_competitors") && !fresh.has("keyword_gaps")) {
    research.push("competitor_research");
  }
  if (!fresh.has("keyword_strategy")) {
    research.push("keyword_intent");
  }
  if (!fresh.has("serp_blueprint") && input.keywordCount > 0) {
    research.push("serp_research");
  }
  if (!fresh.has("backlink_gap") && !fresh.has("authority_plan")) {
    research.push("authority");
  }

  // Bound research so a single run cannot call every expensive API.
  const boundedResearch = research.slice(0, 3);

  return {
    research: boundedResearch,
    contentBudget: Math.max(1, Math.min(input.maxItems, MAX_MANAGER_ITEMS)),
    includeGeo: true,
    includeLocal: input.businessModel === "local_service",
    includeAudit: true,
    includeAuthority: boundedResearch.includes("authority"),
    includePerformance: true,
  };
}

export function parseManagerPlan(raw: unknown, maxItems: number): ManagerPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items: ManagerPlanItem[] = [];
  for (const it of itemsRaw) {
    if (!it || typeof it !== "object") continue;
    const row = it as Record<string, unknown>;
    const capability = String(row.capability || "content") as AgentCapability;
    const objective = String(row.objective || row.rationale || "").trim();
    if (!objective) continue;
    items.push({
      capability,
      objective,
      task_type: (row.task_type as ProposedActionType | undefined) || undefined,
      target_url: (row.target_url as string | null | undefined) ?? null,
      target_keyword: (row.target_keyword as string | null | undefined) ?? null,
      rationale: String(row.rationale || objective),
      risk_level: normalizeRisk(row.risk_level),
      confidence: clampConfidence(row.confidence, 0.6),
      depends_on_capabilities: Array.isArray(row.depends_on_capabilities)
        ? (row.depends_on_capabilities as AgentCapability[])
        : undefined,
      priority: typeof row.priority === "number" ? row.priority : 50,
    });
    if (items.length >= maxItems) break;
  }
  return {
    objective: String(o.objective || "Improve organic visibility"),
    summary: String(o.summary || ""),
    items,
    skipped_capabilities: Array.isArray(o.skipped_capabilities)
      ? (o.skipped_capabilities as ManagerPlan["skipped_capabilities"])
      : [],
  };
}

/** Default content plan when the Manager LLM fails — preserves prior stepPlan safety. */
export function fallbackContentItems(
  signals: {
    striking?: { query?: string; page?: string }[] | null;
    lowCtr?: { page?: string; query?: string }[] | null;
  },
  maxItems: number
): ManagerPlanItem[] {
  const items: ManagerPlanItem[] = [];
  for (const s of signals.striking || []) {
    if (items.length >= maxItems) break;
    items.push({
      capability: "content",
      objective: `Improve ranking for ${s.query || s.page}`,
      task_type: "improve_content",
      target_url: s.page || null,
      target_keyword: s.query || null,
      rationale: "Striking-distance keyword from GSC",
      risk_level: "medium",
      confidence: 0.65,
      priority: 40,
    });
  }
  for (const s of signals.lowCtr || []) {
    if (items.length >= maxItems) break;
    items.push({
      capability: "content",
      objective: `Improve CTR for ${s.page}`,
      task_type: "fix_meta",
      target_url: s.page || null,
      target_keyword: s.query || null,
      rationale: "Low-CTR page from GSC",
      risk_level: "low",
      confidence: 0.7,
      priority: 30,
    });
  }
  return items;
}

export async function runSeoManager(
  brand: Brand & { execution_mode?: string | null; autopilot_enabled?: boolean | null },
  runId: string
): Promise<{ planned: number; researchRan: string[] }> {
  const ctx = await buildSharedContext(brand, {
    runId,
    objective: "Coordinate the autonomous SEO team for this run",
  });

  const managerTaskId = await createAgentTask({
    brandId: brand.id,
    runId,
    capability: "seo_manager",
    objective: ctx.current_objective || "Coordinate SEO team",
    riskLevel: "low",
    confidence: 0.8,
    priority: 10,
  });
  if (managerTaskId) {
    await updateAgentTask(brand.id, managerTaskId, {
      status: "running",
      started_at: new Date().toISOString(),
    });
  }

  await recordActivity({
    brandId: brand.id,
    runId,
    taskId: managerTaskId,
    capability: "seo_manager",
    eventType: "manager_started",
    title: "SEO Manager reviewing signals and prior findings",
    status: "info",
  });

  const selection = selectSpecialists({
    businessModel: brand.business_model,
    hasGsc: !!brand.gsc_property,
    openDraftCount: ctx.open_drafts.length,
    competitorCount: ctx.competitors.length,
    keywordCount: ctx.tracked_keywords.length,
    recentFindingTypes: ctx.recent_findings.map((f) => f.finding_type),
    maxItems: MAX_MANAGER_ITEMS,
  });

  const researchRan: string[] = [];

  // Research phase — failures are recorded; Manager continues.
  for (const cap of selection.research) {
    const taskId = await createAgentTask({
      brandId: brand.id,
      runId,
      capability: cap,
      objective: `Run ${cap}`,
      riskLevel: "low",
      priority: 20,
    });
    try {
      if (taskId) {
        await updateAgentTask(brand.id, taskId, {
          status: "running",
          started_at: new Date().toISOString(),
        });
      }
      if (cap === "competitor_research") {
        await runCompetitorResearch(brand, ctx, { runId, taskId });
      } else if (cap === "keyword_intent") {
        await runKeywordIntentStrategy(brand, ctx, { runId, taskId });
      } else if (cap === "serp_research") {
        await runSerpResearch(brand, ctx, { runId, taskId });
      } else if (cap === "authority") {
        await runAuthorityResearch(brand, ctx, { runId, taskId });
      }
      researchRan.push(cap);
      if (taskId) {
        await updateAgentTask(brand.id, taskId, {
          status: "done",
          finished_at: new Date().toISOString(),
          result_summary: `${cap} completed`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (taskId) {
        await updateAgentTask(brand.id, taskId, {
          status: "failed",
          error: msg,
          finished_at: new Date().toISOString(),
        });
      }
      await recordActivity({
        brandId: brand.id,
        runId,
        taskId,
        capability: cap,
        eventType: "specialist_failed",
        title: `${cap} failed`,
        detail: msg.slice(0, 400),
        status: "error",
      });
    }
  }

  // Refresh context slices after research for planning.
  const refreshed = await buildSharedContext(brand, { runId, objective: ctx.current_objective });
  const gsc = brand.gsc_property;
  const [striking, lowCtr, lessons] = await Promise.all([
    gsc ? safe(() => strikingDistance(gsc)) : Promise.resolve(null),
    gsc ? safe(() => lowCtrPages(gsc)) : Promise.resolve(null),
    safe(() => activeLessons(brand)),
  ]);

  const planText = await callClaude({
    maxTokens: 1600,
    label: "seo_manager",
    user: `${brandBlock(brand)}

You are the SEO Manager coordinating a specialist team. Choose the MINIMUM useful set of content actions (max ${selection.contentBudget}). Prefer quick wins and avoid duplicates.

SHARED CONTEXT (selected):
${contextPromptBlock(refreshed, "seo_manager")}

GSC STRIKING DISTANCE:
${JSON.stringify(striking || [], null, 2)}
LOW CTR:
${JSON.stringify(lowCtr || [], null, 2)}
LESSONS:
${JSON.stringify(lessons || [], null, 2)}

Rules:
- Prefer improve_content/fix_meta when a page already exists for the topic.
- Never invent SERP/competitor metrics not present in context.
- Assign risk_level and confidence honestly.
- task_type must be one of fix_meta|improve_content|new_page|new_blog.

Return ONLY JSON:
{"objective":"...","summary":"one sentence decision summary","items":[{"capability":"content","objective":"...","task_type":"fix_meta|improve_content|new_page|new_blog","target_url":null,"target_keyword":"...","rationale":"...","risk_level":"low|medium|high","confidence":0.0-1.0,"priority":1-100}],"skipped_capabilities":[{"capability":"...","reason":"..."}]}`,
  }).catch(() => "");

  let plan = parseManagerPlan(extractJSON(planText), selection.contentBudget);
  if (!plan || !plan.items.length) {
    plan = {
      objective: "Improve organic visibility from GSC signals",
      summary: "Manager LLM unavailable — fell back to GSC-driven content tasks.",
      items: fallbackContentItems(
        {
          striking: striking as { query?: string; page?: string }[] | null,
          lowCtr: lowCtr as { page?: string; query?: string }[] | null,
        },
        selection.contentBudget
      ),
      skipped_capabilities: [],
    };
  }

  await recordActivity({
    brandId: brand.id,
    runId,
    taskId: managerTaskId,
    capability: "seo_manager",
    eventType: "manager_planned",
    title: plan.summary || plan.objective,
    detail: `${plan.items.length} content tasks; research: ${researchRan.join(", ") || "none"}`,
    decision: plan.objective,
    status: "info",
    metadata: {
      items: plan.items.map((i) => ({
        task_type: i.task_type,
        keyword: i.target_keyword,
        risk: i.risk_level,
      })),
      researchRan,
      mode: refreshed.execution_mode,
    },
  });

  // Enqueue content jobs (existing queue) + create agent_tasks for observability.
  let planned = 0;
  for (const item of plan.items) {
    const taskType = asTaskType(item.task_type) || "improve_content";
    const risk: RiskLevel = item.risk_level;
    const taskId = await createAgentTask({
      brandId: brand.id,
      runId,
      capability: "content",
      objective: item.objective,
      riskLevel: risk,
      confidence: item.confidence,
      priority: item.priority,
      payload: {
        task_type: taskType,
        target_url: item.target_url,
        target_keyword: item.target_keyword,
        rationale: item.rationale,
      },
    });
    await enqueue(brand.id, "content", {
      task_type: taskType,
      target_url: item.target_url,
      target_keyword: item.target_keyword,
      rationale: item.rationale,
      risk_level: risk,
      confidence: item.confidence,
      runId,
      agentTaskId: taskId,
    });
    planned++;
  }

  // Specialist follow-on jobs — same as prior stepPlan, but Manager-gated.
  await enqueue(brand.id, "geo", { runId });
  if (selection.includeLocal && isLocalBusiness(brand)) {
    await enqueue(brand.id, "gbp", { runId });
    await enqueue(brand.id, "citations", { runId });
  }
  if (selection.includeAudit) await enqueue(brand.id, "audit", { runId });
  // Authority already ran inline when selected; avoid duplicate citation spam.
  if (selection.includePerformance) await enqueue(brand.id, "performance", { runId });

  await db.from("runs").update({ tasks_planned: planned }).eq("id", runId);

  if (managerTaskId) {
    await updateAgentTask(brand.id, managerTaskId, {
      status: "done",
      finished_at: new Date().toISOString(),
      result_summary: plan.summary || `Planned ${planned} tasks`,
    });
  }

  await recordActivity({
    brandId: brand.id,
    runId,
    taskId: managerTaskId,
    capability: "seo_manager",
    eventType: "manager_delegated",
    title: `Delegated ${planned} content tasks to specialists`,
    status: "success",
  });

  return { planned, researchRan };
}
