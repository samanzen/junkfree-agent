// Feature 01 — autopilot / hybrid / approval policy engine.
// Single decision point for whether an action may auto-execute, needs human
// approval, or must be blocked. Keep this pure and unit-tested.

import type {
  Confidence,
  ExecutionMode,
  PolicyDecision,
  ProposedActionType,
  QaOutcome,
  RiskLevel,
} from "../agents/contracts";
import { clampConfidence, isExecutionMode, modeFromLegacy } from "../agents/contracts";

export type PolicyActionInput = {
  brandId: string;
  mode: ExecutionMode;
  autopilotEnabled: boolean;
  actionType: ProposedActionType | string;
  riskLevel: RiskLevel;
  confidence: Confidence;
  qaOutcome?: QaOutcome | null;
  adapterAvailable: boolean;
  reversible: boolean;
  withinRunLimits: boolean;
  withinRateLimits?: boolean;
  duplicateSuspected?: boolean;
  cannibalizationSuspected?: boolean;
  /** True when the action would change a live CMS via an adapter. */
  requiresLivePublish?: boolean;
};

const LOW_RISK_AUTO: ReadonlySet<string> = new Set(["fix_meta"]);

/** Resolve effective mode from brand columns (new + legacy). */
export function resolveExecutionMode(brand: {
  execution_mode?: string | null;
  auto_publish_meta?: boolean | null;
}): ExecutionMode {
  if (isExecutionMode(brand.execution_mode)) return brand.execution_mode;
  return modeFromLegacy(!!brand.auto_publish_meta);
}

/**
 * Central policy decision. Never silently publishes restricted actions in
 * Approval mode. Hybrid only auto-executes explicitly safe, reversible,
 * high-confidence actions. Autopilot still respects QA, risk, confidence,
 * adapter availability, and kill-switch.
 */
export function decidePolicy(input: PolicyActionInput): PolicyDecision {
  const confidence = clampConfidence(input.confidence);
  const base = {
    mode: input.mode,
    action_type: input.actionType,
    risk_level: input.riskLevel,
    confidence,
  };

  if (!input.withinRunLimits) {
    return { ...base, decision: "BLOCK", reason: "Run or task limit reached." };
  }
  if (input.withinRateLimits === false) {
    return { ...base, decision: "BLOCK", reason: "Tenant rate limit would be exceeded." };
  }
  if (input.duplicateSuspected) {
    return { ...base, decision: "BLOCK", reason: "Duplicate or overlapping work detected." };
  }
  if (input.cannibalizationSuspected) {
    return {
      ...base,
      decision: "REQUIRE_APPROVAL",
      reason: "Keyword cannibalization risk — human review required.",
    };
  }
  if (input.qaOutcome === "BLOCK") {
    return { ...base, decision: "BLOCK", reason: "QA blocked this work." };
  }
  if (input.qaOutcome === "REVISE") {
    return {
      ...base,
      decision: "REQUIRE_APPROVAL",
      reason: "QA requested revision before execution.",
    };
  }
  if (input.riskLevel === "critical") {
    return { ...base, decision: "BLOCK", reason: "Critical-risk actions cannot auto-execute." };
  }

  // Emergency kill switch: force approval even in Autopilot/Hybrid.
  if (!input.autopilotEnabled && input.mode !== "approval") {
    return {
      ...base,
      decision: "REQUIRE_APPROVAL",
      reason: "Autopilot disabled for this brand — requiring approval.",
    };
  }

  if (input.mode === "approval") {
    return {
      ...base,
      decision: "REQUIRE_APPROVAL",
      reason: "Approval mode: site-changing actions wait for a human.",
    };
  }

  const isLowRiskAutoCandidate =
    LOW_RISK_AUTO.has(input.actionType) &&
    input.riskLevel === "low" &&
    confidence >= 0.7 &&
    input.reversible &&
    (input.qaOutcome === "PASS" || input.qaOutcome == null);

  if (input.mode === "hybrid") {
    if (!isLowRiskAutoCandidate) {
      return {
        ...base,
        decision: "REQUIRE_APPROVAL",
        reason: "Hybrid mode only auto-executes safe, reversible, high-confidence meta fixes.",
      };
    }
    return {
      ...base,
      decision: "AUTO_EXECUTE",
      reason: "Hybrid policy: low-risk reversible meta fix with sufficient confidence.",
    };
  }

  // Autopilot
  if (input.riskLevel === "high") {
    return {
      ...base,
      decision: "REQUIRE_APPROVAL",
      reason: "Autopilot still requires approval for high-risk actions.",
    };
  }
  if (confidence < 0.55) {
    return {
      ...base,
      decision: "REQUIRE_APPROVAL",
      reason: "Confidence below Autopilot threshold.",
    };
  }
  if (input.qaOutcome != null && input.qaOutcome !== "PASS") {
    return {
      ...base,
      decision: "REQUIRE_APPROVAL",
      reason: "Autopilot requires QA PASS before execution.",
    };
  }
  if (input.requiresLivePublish && !input.adapterAvailable) {
    return {
      ...base,
      decision: "REQUIRE_APPROVAL",
      reason: "No publishing adapter connected for live site changes.",
    };
  }
  if (input.riskLevel === "medium" && confidence < 0.75) {
    return {
      ...base,
      decision: "REQUIRE_APPROVAL",
      reason: "Medium-risk Autopilot actions require higher confidence.",
    };
  }

  return {
    ...base,
    decision: "AUTO_EXECUTE",
    reason: "Autopilot policy: within guardrails, QA clear, confidence sufficient.",
  };
}
