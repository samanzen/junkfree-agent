// Feature 01 — shared agent contracts.
// Machine-consumable specialist outputs for the SEO Manager.
// No `any`; invalid LLM payloads are rejected by validators in lib/qa and
// lib/seo-manager rather than silently trusted.

export type AgentCapability =
  | "seo_manager"
  | "planner"
  | "content"
  | "geo"
  | "local_seo"
  | "citations"
  | "audit"
  | "intelligence"
  | "performance"
  | "assistant"
  | "competitor_research"
  | "keyword_intent"
  | "serp_research"
  | "technical_execution"
  | "qa_critic"
  | "authority"
  | "publish_checker"
  | "outcome_reporter";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Confidence = number; // 0..1

export type ExecutionMode = "approval" | "hybrid" | "autopilot";

export type PolicyDecisionKind = "AUTO_EXECUTE" | "REQUIRE_APPROVAL" | "BLOCK";

export type AgentTaskStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "blocked"
  | "waiting_approval"
  | "revised";

export type QaOutcome = "PASS" | "REVISE" | "BLOCK";

export type ProposedActionType =
  | "fix_meta"
  | "improve_content"
  | "new_page"
  | "new_blog"
  | "geo_answers"
  | "technical_fix"
  | "research"
  | "monitor"
  | "manual";

export type ProposedAction = {
  type: ProposedActionType;
  target_url?: string | null;
  target_keyword?: string | null;
  rationale: string;
  risk_level: RiskLevel;
  confidence: Confidence;
  reversible: boolean;
  requires_adapter?: boolean;
};

export type AgentFinding = {
  capability: AgentCapability;
  finding_type: string;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  recommendations: string[];
  proposed_actions: ProposedAction[];
  confidence: Confidence;
  risk_level: RiskLevel;
};

export type SpecialistResultStatus = "ok" | "degraded" | "failed" | "skipped";

export type SpecialistResult = {
  capability: AgentCapability;
  brand_id: string;
  run_id: string | null;
  task_id: string | null;
  objective: string;
  findings: AgentFinding[];
  recommendations: string[];
  proposed_actions: ProposedAction[];
  evidence: Record<string, unknown>;
  confidence: Confidence;
  risk_level: RiskLevel;
  dependencies: string[];
  artifacts: { kind: string; id?: string; label: string }[];
  status: SpecialistResultStatus;
  errors: string[];
  created_at: string;
};

export type PolicyDecision = {
  decision: PolicyDecisionKind;
  reason: string;
  mode: ExecutionMode;
  action_type: ProposedActionType | string;
  risk_level: RiskLevel;
  confidence: Confidence;
};

export type ManagerPlanItem = {
  capability: AgentCapability;
  objective: string;
  task_type?: ProposedActionType;
  target_url?: string | null;
  target_keyword?: string | null;
  rationale: string;
  risk_level: RiskLevel;
  confidence: Confidence;
  depends_on_capabilities?: AgentCapability[];
  priority: number;
};

export type ManagerPlan = {
  objective: string;
  summary: string;
  items: ManagerPlanItem[];
  skipped_capabilities: { capability: AgentCapability; reason: string }[];
};

export const MAX_MANAGER_ITEMS = Number(process.env.MAX_TASKS_PER_RUN || 3);
export const MAX_QA_REVISIONS = 1;
export const FRESH_FINDING_HOURS = 72;

export function clampConfidence(n: unknown, fallback = 0.5): Confidence {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

export function isRiskLevel(v: unknown): v is RiskLevel {
  return v === "low" || v === "medium" || v === "high" || v === "critical";
}

export function isExecutionMode(v: unknown): v is ExecutionMode {
  return v === "approval" || v === "hybrid" || v === "autopilot";
}

export function isQaOutcome(v: unknown): v is QaOutcome {
  return v === "PASS" || v === "REVISE" || v === "BLOCK";
}

export function normalizeRisk(v: unknown, fallback: RiskLevel = "medium"): RiskLevel {
  return isRiskLevel(v) ? v : fallback;
}

/** Map legacy auto_publish_meta onto Feature 01 modes. */
export function modeFromLegacy(autoPublishMeta: boolean): ExecutionMode {
  return autoPublishMeta ? "hybrid" : "approval";
}

/** Keep auto_publish_meta in sync for older UI/code paths during migration. */
export function legacyFromMode(mode: ExecutionMode): boolean {
  return mode === "hybrid" || mode === "autopilot";
}

export function emptySpecialistResult(
  partial: Pick<SpecialistResult, "capability" | "brand_id" | "run_id" | "task_id" | "objective"> &
    Partial<SpecialistResult>
): SpecialistResult {
  return {
    findings: [],
    recommendations: [],
    proposed_actions: [],
    evidence: {},
    confidence: 0,
    risk_level: "medium",
    dependencies: [],
    artifacts: [],
    status: "skipped",
    errors: [],
    created_at: new Date().toISOString(),
    ...partial,
  };
}
