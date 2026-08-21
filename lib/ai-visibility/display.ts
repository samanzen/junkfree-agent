// AI VISIBILITY — labels and copy shared by every report surface.
//
// The API returns machine ids (`openai`, `discovery`, `en`). The dashboard and
// the portal both have to turn those into words a person can read, and both
// have to phrase the mention rate the same way: "named in 6 of 12 questions",
// never a lone percentage pretending the answers are deterministic.
//
// Pure on purpose. Unit-tested without a DOM, and importable from a server
// module if a future surface (email, PDF) needs the same wording.

import type { VisibilityReport } from "./report";

export type Audience = "admin" | "customer";

export type AssistantConfigured = {
  id: string;
  label: string;
  requires: string;
  available: boolean;
};

export type LatestRun = {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  prompts_planned: number;
  checks_completed: number;
  checks_failed: number;
  mention_rate: number | null;
};

/** Shape of GET /api/intelligence/ai-visibility. */
export type AiVisibilityResponse = {
  available: boolean;
  reason: "not_migrated" | "no_runs" | null;
  detail?: string;
  assistants_configured: AssistantConfigured[];
  latest_run?: LatestRun;
  runs_in_scope?: number;
  summary?: string | null;
  summary_at?: string | null;
  report: VisibilityReport | null;
  error?: string;
};

export const ASSISTANT_LABELS: Record<string, string> = {
  claude: "Claude",
  gemini: "Gemini",
  openai: "ChatGPT",
  perplexity: "Perplexity",
  ai_overview: "Google AI Overview",
};

export const INTENT_LABELS: Record<string, string> = {
  discovery: "Discovery",
  recommendation: "Recommendation",
  proximity: "Nearby",
  comparison: "Comparison",
  price: "Price",
  trust: "Trust",
  problem: "Problem",
  brand: "Brand",
  alternative: "Alternatives",
};

export function assistantLabel(id: string): string {
  return ASSISTANT_LABELS[id] || id;
}

export function intentLabel(id: string | null | undefined): string {
  if (!id) return "—";
  return INTENT_LABELS[id] || id;
}

export function languageLabel(code: string | null | undefined): string {
  if (!code) return "—";
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(code);
    if (name) return name;
  } catch {
    /* Intl.DisplayNames is missing or does not know the code. */
  }
  return code;
}

/** Headline: always counts, never a percentage on its own. */
export function namedIn(mentioned: number, scorable: number): string {
  if (scorable <= 0) return "No scored answers yet";
  return `Named in ${mentioned} of ${scorable}`;
}

export function formatPct(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  const n = Number.isInteger(rate) ? String(rate) : rate.toFixed(1);
  return `${n}%`;
}

/** Compact sample size shown next to a percentage. */
export function ofSample(mentioned: number, scorable: number): string {
  if (scorable <= 0) return "no sample";
  return `${mentioned} of ${scorable}`;
}

export function rateTone(rate: number | null | undefined): "g" | "a" | "b" | "m" {
  if (rate == null) return "m";
  if (rate >= 50) return "g";
  if (rate >= 25) return "a";
  return "b";
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function emptyTitle(reason: string | null | undefined, hasAssistants: boolean): string {
  if (reason === "not_migrated") return "AI visibility is not enabled yet";
  if (!hasAssistants) return "No assistant is configured";
  return "No sweep has run yet";
}

export function emptyBody(
  reason: string | null | undefined,
  hasAssistants: boolean,
  audience: Audience
): string {
  if (reason === "not_migrated") {
    return audience === "admin"
      ? "Apply supabase/018_ai_visibility.sql in the SQL editor. Until then the sweep skips and this page stays empty."
      : "We're still turning this measurement on. Check back after the next update.";
  }
  if (!hasAssistants) {
    return audience === "admin"
      ? "Set at least one of ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, PERPLEXITY_API_KEY, or DataForSEO credentials."
      : "We haven't started asking AI assistants whether they recommend you. That begins once measurement is switched on.";
  }
  return audience === "admin"
    ? "The weekly Tuesday sweep has not run for this brand. Run one now, or wait for the next scheduled tick."
    : "The first measurement has not finished yet. Every week we ask AI assistants the questions a customer would ask, and whether they name you.";
}

export function hasConfiguredAssistants(assistants: AssistantConfigured[] | undefined): boolean {
  return (assistants || []).some((a) => a.available);
}
