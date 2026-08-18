// Feature 01 — persist Manager tasks, findings, QA, and activity.
// Best-effort writes: if migration 013 is not applied yet, specialists still
// run; coordination ledger simply stays empty (same pattern as page_audits).

import { db } from "../supabase";
import type {
  AgentCapability,
  AgentFinding,
  AgentTaskStatus,
  QaOutcome,
  RiskLevel,
  SpecialistResult,
} from "./contracts";

const MIGRATION_MISSING = new Set(["PGRST205", "42P01"]);

async function softWrite<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export type AgentTaskRow = {
  id: string;
  brand_id: string;
  run_id: string | null;
  capability: AgentCapability;
  objective: string;
  status: AgentTaskStatus;
  risk_level: RiskLevel;
  confidence: number | null;
  payload: Record<string, unknown>;
  revision_count: number;
  max_revisions: number;
};

export async function createAgentTask(input: {
  brandId: string;
  runId?: string | null;
  capability: AgentCapability;
  objective: string;
  riskLevel?: RiskLevel;
  confidence?: number | null;
  priority?: number;
  dependsOn?: string[];
  payload?: Record<string, unknown>;
  maxRevisions?: number;
}): Promise<string | null> {
  return softWrite(async () => {
    const { data, error } = await db
      .from("agent_tasks")
      .insert({
        brand_id: input.brandId,
        run_id: input.runId ?? null,
        capability: input.capability,
        objective: input.objective,
        status: "queued",
        risk_level: input.riskLevel ?? "medium",
        confidence: input.confidence ?? null,
        priority: input.priority ?? 50,
        depends_on: input.dependsOn ?? [],
        payload: input.payload ?? {},
        max_revisions: input.maxRevisions ?? 1,
      })
      .select("id")
      .single();
    if (error) {
      if (!MIGRATION_MISSING.has(error.code)) {
        console.warn(`[agent-store] createAgentTask: ${error.message}`);
      }
      return null;
    }
    return data?.id ?? null;
  });
}

export async function updateAgentTask(
  brandId: string,
  taskId: string,
  patch: Partial<{
    status: AgentTaskStatus;
    result_summary: string | null;
    error: string | null;
    job_id: string | null;
    revision_count: number;
    started_at: string | null;
    finished_at: string | null;
    confidence: number | null;
  }>
): Promise<void> {
  await softWrite(async () => {
    const { error } = await db
      .from("agent_tasks")
      .update(patch)
      .eq("id", taskId)
      .eq("brand_id", brandId);
    if (error && !MIGRATION_MISSING.has(error.code)) {
      console.warn(`[agent-store] updateAgentTask: ${error.message}`);
    }
  });
}

export async function persistFindings(
  brandId: string,
  runId: string | null,
  taskId: string | null,
  findings: AgentFinding[]
): Promise<void> {
  if (!findings.length) return;
  await softWrite(async () => {
    const rows = findings.map((f) => ({
      brand_id: brandId,
      run_id: runId,
      task_id: taskId,
      capability: f.capability,
      finding_type: f.finding_type,
      title: f.title,
      summary: f.summary,
      evidence: f.evidence,
      recommendations: f.recommendations,
      proposed_actions: f.proposed_actions,
      confidence: f.confidence,
      risk_level: f.risk_level,
      status: "active",
    }));
    const { error } = await db.from("agent_findings").insert(rows);
    if (error && !MIGRATION_MISSING.has(error.code)) {
      console.warn(`[agent-store] persistFindings: ${error.message}`);
    }
  });
}

export async function persistSpecialistResult(result: SpecialistResult): Promise<void> {
  await persistFindings(result.brand_id, result.run_id, result.task_id, result.findings);
}

export async function recordQaResult(input: {
  brandId: string;
  runId?: string | null;
  taskId?: string | null;
  draftId?: string | null;
  outcome: QaOutcome;
  score?: number | null;
  issues?: unknown[];
  feedback?: string | null;
  revisionAttempt?: number;
}): Promise<string | null> {
  return softWrite(async () => {
    const { data, error } = await db
      .from("agent_qa_results")
      .insert({
        brand_id: input.brandId,
        run_id: input.runId ?? null,
        task_id: input.taskId ?? null,
        draft_id: input.draftId ?? null,
        outcome: input.outcome,
        score: input.score ?? null,
        issues: input.issues ?? [],
        feedback: input.feedback ?? null,
        revision_attempt: input.revisionAttempt ?? 0,
      })
      .select("id")
      .single();
    if (error) {
      if (!MIGRATION_MISSING.has(error.code)) {
        console.warn(`[agent-store] recordQaResult: ${error.message}`);
      }
      return null;
    }
    return data?.id ?? null;
  });
}

export async function recordActivity(input: {
  brandId: string;
  runId?: string | null;
  taskId?: string | null;
  capability?: AgentCapability | string | null;
  eventType: string;
  title: string;
  detail?: string | null;
  decision?: string | null;
  status?: "info" | "success" | "warning" | "error" | "blocked" | "waiting";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await softWrite(async () => {
    const { error } = await db.from("agent_activity").insert({
      brand_id: input.brandId,
      run_id: input.runId ?? null,
      task_id: input.taskId ?? null,
      capability: input.capability ?? null,
      event_type: input.eventType,
      title: input.title,
      detail: input.detail ?? null,
      decision: input.decision ?? null,
      status: input.status ?? "info",
      metadata: input.metadata ?? {},
    });
    if (error && !MIGRATION_MISSING.has(error.code)) {
      console.warn(`[agent-store] recordActivity: ${error.message}`);
    }
  });
}

export async function listRecentActivity(
  brandId: string,
  limit = 40
): Promise<
  {
    id: string;
    capability: string | null;
    event_type: string;
    title: string;
    detail: string | null;
    decision: string | null;
    status: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }[]
> {
  const { data, error } = await db
    .from("agent_activity")
    .select("id, capability, event_type, title, detail, decision, status, created_at, metadata")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!MIGRATION_MISSING.has(error.code)) {
      console.warn(`[agent-store] listRecentActivity: ${error.message}`);
    }
    return [];
  }
  return (data || []) as {
    id: string;
    capability: string | null;
    event_type: string;
    title: string;
    detail: string | null;
    decision: string | null;
    status: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }[];
}

export async function listActiveFindings(
  brandId: string,
  capability?: AgentCapability,
  limit = 30
): Promise<
  {
    id: string;
    capability: string;
    finding_type: string;
    title: string;
    summary: string | null;
    evidence: Record<string, unknown>;
    proposed_actions: unknown;
    confidence: number | null;
    risk_level: string;
    created_at: string;
  }[]
> {
  let q = db
    .from("agent_findings")
    .select(
      "id, capability, finding_type, title, summary, evidence, proposed_actions, confidence, risk_level, created_at"
    )
    .eq("brand_id", brandId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (capability) q = q.eq("capability", capability);
  const { data, error } = await q;
  if (error) {
    if (!MIGRATION_MISSING.has(error.code)) {
      console.warn(`[agent-store] listActiveFindings: ${error.message}`);
    }
    return [];
  }
  return (data || []) as {
    id: string;
    capability: string;
    finding_type: string;
    title: string;
    summary: string | null;
    evidence: Record<string, unknown>;
    proposed_actions: unknown;
    confidence: number | null;
    risk_level: string;
    created_at: string;
  }[];
}

export async function countTasksInRun(brandId: string, runId: string): Promise<number> {
  const { count, error } = await db
    .from("agent_tasks")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("run_id", runId);
  if (error) return 0;
  return count || 0;
}
