// Feature 01 — SEO QA / Critic.
// Independent gate before important work is approved or auto-published.
// Outcomes: PASS | REVISE | BLOCK. Revision loops are bounded by the caller.

import { callClaude, extractJSON } from "../anthropic";
import { brandBlock, type Brand } from "../brands";
import {
  clampConfidence,
  emptySpecialistResult,
  isQaOutcome,
  MAX_QA_REVISIONS,
  type QaOutcome,
  type SpecialistResult,
} from "../agents/contracts";
import { contextPromptBlock, type SharedAgentContext } from "../agents/context";
import { recordActivity, recordQaResult } from "../agents/store";

export type QaEvaluation = {
  outcome: QaOutcome;
  score: number;
  issues: { code: string; severity: "low" | "medium" | "high"; message: string }[];
  feedback: string;
};

export function parseQaEvaluation(raw: unknown): QaEvaluation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isQaOutcome(o.outcome)) return null;
  const issues = Array.isArray(o.issues)
    ? o.issues
        .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
        .map((i) => {
          const severity: "low" | "medium" | "high" =
            i.severity === "high" || i.severity === "medium" || i.severity === "low"
              ? i.severity
              : "medium";
          return {
            code: String(i.code || "issue"),
            severity,
            message: String(i.message || ""),
          };
        })
        .filter((i) => i.message)
    : [];
  const score =
    typeof o.score === "number" && Number.isFinite(o.score)
      ? Math.max(0, Math.min(100, o.score))
      : o.outcome === "PASS"
        ? 80
        : o.outcome === "REVISE"
          ? 50
          : 20;
  return {
    outcome: o.outcome,
    score,
    issues,
    feedback: String(o.feedback || ""),
  };
}

/** Heuristic pre-check before spending an LLM call. */
export function heuristicQaGate(input: {
  title: string;
  body: string;
  taskType: string;
  brandName: string;
  services: string | null;
  serviceArea: string | null;
}): QaEvaluation | null {
  const body = (input.body || "").trim();
  const title = (input.title || "").trim();
  const issues: QaEvaluation["issues"] = [];

  if (!body || body.length < 40) {
    issues.push({
      code: "thin_content",
      severity: "high",
      message: "Body is empty or too short to publish.",
    });
  }
  if (!title) {
    issues.push({ code: "missing_title", severity: "high", message: "Missing title." });
  }

  // Hallucinated brand names — crude but useful: other brand placeholders.
  const lower = body.toLowerCase();
  const brandLower = input.brandName.toLowerCase();
  if (brandLower && !lower.includes(brandLower.split(" ")[0] || brandLower) && input.taskType !== "fix_meta") {
    // Not a hard fail — many meta rewrites legitimately omit the brand.
  }

  const stuffing =
    (input.services || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 4)
      .filter((s) => (lower.split(s).length - 1) >= 12).length > 0;
  if (stuffing) {
    issues.push({
      code: "keyword_stuffing",
      severity: "high",
      message: "Possible keyword stuffing detected.",
    });
  }

  if (issues.some((i) => i.severity === "high" && i.code === "thin_content")) {
    return {
      outcome: "BLOCK",
      score: 10,
      issues,
      feedback: issues.map((i) => i.message).join(" "),
    };
  }
  if (issues.length) {
    return {
      outcome: "REVISE",
      score: 40,
      issues,
      feedback: issues.map((i) => i.message).join(" "),
    };
  }
  return null;
}

export async function runQaCritic(opts: {
  brand: Brand;
  ctx: SharedAgentContext;
  runId?: string | null;
  taskId?: string | null;
  draftId?: string | null;
  title: string;
  body: string;
  taskType: string;
  targetKeyword?: string | null;
  revisionAttempt?: number;
}): Promise<{ evaluation: QaEvaluation; result: SpecialistResult }> {
  const revisionAttempt = opts.revisionAttempt ?? 0;
  const heuristic = heuristicQaGate({
    title: opts.title,
    body: opts.body,
    taskType: opts.taskType,
    brandName: opts.brand.name,
    services: opts.brand.services,
    serviceArea: opts.brand.service_area,
  });

  let evaluation: QaEvaluation;
  if (heuristic && heuristic.outcome === "BLOCK") {
    evaluation = heuristic;
  } else {
    const text = await callClaude({
      maxTokens: 900,
      label: "qa_critic",
      user: `${brandBlock(opts.brand)}

You are an independent SEO QA Critic. Do NOT rewrite the content. Evaluate only.

CONTEXT:
${contextPromptBlock(opts.ctx, "qa_critic")}

TASK TYPE: ${opts.taskType}
TARGET KEYWORD: ${opts.targetKeyword || "n/a"}
TITLE: ${opts.title}
BODY:
${opts.body.slice(0, 8000)}

Check for: factual/business accuracy, unsupported claims, hallucinated details, search intent fit, thin/duplicate content, keyword stuffing, cannibalization risk, brand/geo/service consistency, SEO and GEO quality.

Return ONLY JSON:
{"outcome":"PASS"|"REVISE"|"BLOCK","score":0-100,"issues":[{"code":"...","severity":"low|medium|high","message":"..."}],"feedback":"actionable revision notes if REVISE/BLOCK, else short confirmation"}`,
    }).catch(() => "");

    const parsed = parseQaEvaluation(extractJSON(text));
    evaluation =
      parsed ||
      heuristic || {
        outcome: "REVISE",
        score: 45,
        issues: [{ code: "qa_parse_failed", severity: "medium", message: "QA response was invalid; requiring review." }],
        feedback: "QA could not be parsed safely — human review required.",
      };

    // Never escalate a heuristic REVISE into PASS without model agreement when
    // the model failed — already handled by fallback above.
  }

  // Bound revisions: if we've already revised max times, escalate REVISE → BLOCK
  // so Autopilot cannot loop forever.
  if (evaluation.outcome === "REVISE" && revisionAttempt >= MAX_QA_REVISIONS) {
    evaluation = {
      ...evaluation,
      outcome: "BLOCK",
      feedback: `${evaluation.feedback} (revision limit reached — blocked from auto-publish)`,
    };
  }

  await recordQaResult({
    brandId: opts.brand.id,
    runId: opts.runId,
    taskId: opts.taskId,
    draftId: opts.draftId,
    outcome: evaluation.outcome,
    score: evaluation.score,
    issues: evaluation.issues,
    feedback: evaluation.feedback,
    revisionAttempt,
  });

  await recordActivity({
    brandId: opts.brand.id,
    runId: opts.runId,
    taskId: opts.taskId,
    capability: "qa_critic",
    eventType: `qa_${evaluation.outcome.toLowerCase()}`,
    title: `QA ${evaluation.outcome}: ${opts.title.slice(0, 80)}`,
    detail: evaluation.feedback.slice(0, 400),
    decision: evaluation.outcome,
    status:
      evaluation.outcome === "PASS"
        ? "success"
        : evaluation.outcome === "BLOCK"
          ? "blocked"
          : "warning",
    metadata: { score: evaluation.score, draftId: opts.draftId },
  });

  const result = emptySpecialistResult({
    capability: "qa_critic",
    brand_id: opts.brand.id,
    run_id: opts.runId ?? null,
    task_id: opts.taskId ?? null,
    objective: `QA ${opts.taskType}: ${opts.title}`,
    status: "ok",
    confidence: clampConfidence(evaluation.score / 100),
    risk_level: evaluation.outcome === "BLOCK" ? "high" : evaluation.outcome === "REVISE" ? "medium" : "low",
    evidence: { evaluation },
    recommendations: evaluation.feedback ? [evaluation.feedback] : [],
    findings: [
      {
        capability: "qa_critic",
        finding_type: `qa_${evaluation.outcome.toLowerCase()}`,
        title: `QA ${evaluation.outcome}`,
        summary: evaluation.feedback,
        evidence: { issues: evaluation.issues, score: evaluation.score },
        recommendations: evaluation.feedback ? [evaluation.feedback] : [],
        proposed_actions: [],
        confidence: clampConfidence(evaluation.score / 100),
        risk_level: evaluation.outcome === "BLOCK" ? "high" : "medium",
      },
    ],
  });

  return { evaluation, result };
}

export function canAutoPublishAfterQa(outcome: QaOutcome): boolean {
  return outcome === "PASS";
}
