// AI VISIBILITY — assistant providers.
//
// One interface over every assistant we can ask, so the run loop, the store and
// the report never branch on which vendor answered. Adding an assistant means
// adding a file here and one entry in PROVIDERS — nothing else changes.
//
// Providers OBSERVE. They send a question, return the text and the sources, and
// never interpret: no mention detection, no ranking, no sentiment. That all
// lives in ../analyze.ts, which is pure and therefore re-runnable over stored
// answers. Keeping the split strict is what makes a parser improvement
// applicable to history instead of requiring the whole sweep to be paid for
// again.
//
// Every provider is OPTIONAL. `available()` reports whether its credentials are
// present, and the run loop simply skips the ones that are not configured. A
// brand with only ANTHROPIC_API_KEY set still gets a working report; adding
// GEMINI_API_KEY widens it without any other change.

import type { AssistantAnswer, AssistantId, Locale } from "../types";
import { claudeProvider } from "./claude";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";
import { perplexityProvider } from "./perplexity";
import { aiOverviewProvider } from "./ai-overviews";

export type AssistantProvider = {
  id: AssistantId;
  /** Shown in the report. */
  label: string;
  /** Which env var switches this provider on, for operator-facing messages. */
  requires: string;
  /** True when the credentials this provider needs are present. */
  available: () => boolean;
  /**
   * Ask one question. Must never throw: a failure is returned as an answer with
   * `error` set and empty text, so the check is still recorded and a provider
   * outage is visible in the data instead of looking like lost visibility.
   */
  ask: (promptText: string, locale: Locale | null) => Promise<AssistantAnswer>;
};

/** Every provider the application knows about, in reporting order. */
export const PROVIDERS: AssistantProvider[] = [
  claudeProvider,
  geminiProvider,
  openaiProvider,
  perplexityProvider,
  aiOverviewProvider,
];

/** Providers whose credentials are actually configured. */
export function availableProviders(): AssistantProvider[] {
  return PROVIDERS.filter((p) => p.available());
}

/**
 * Resolve the assistants to use for a run.
 *
 * `AI_VISIBILITY_ASSISTANTS` (comma-separated ids) narrows the set, which is how
 * an operator caps spend without removing a key that other features use — the
 * Gemini key, for instance, is also what generates post images.
 */
export function selectedProviders(): AssistantProvider[] {
  const configured = availableProviders();
  const wanted = (process.env.AI_VISIBILITY_ASSISTANTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!wanted.length) return configured;
  return configured.filter((p) => wanted.includes(p.id));
}

export function providerById(id: AssistantId): AssistantProvider | null {
  return PROVIDERS.find((p) => p.id === id) || null;
}

/** Timing + error wrapper every provider uses, so latency is measured the same
 *  way everywhere and a thrown exception can never escape a provider. */
export async function timedAnswer(
  assistant: AssistantId,
  model: string | null,
  run: () => Promise<{ text: string; citations: AssistantAnswer["citations"] }>
): Promise<AssistantAnswer> {
  const startedAt = Date.now();
  try {
    const { text, citations } = await run();
    return {
      assistant,
      model,
      text,
      citations,
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[ai-visibility] ${assistant} failed: ${message}`);
    return {
      assistant,
      model,
      text: "",
      citations: [],
      latencyMs: Date.now() - startedAt,
      error: message.slice(0, 500),
    };
  }
}

/** Cap on how much of an answer is worth keeping. Assistants occasionally
 *  return very long replies; the analyser only needs the recommendation body,
 *  and storing megabytes per check would bloat the table for no gain. */
export const MAX_ANSWER_CHARS = 12_000;

export function truncateAnswer(text: string): string {
  return text.length > MAX_ANSWER_CHARS ? text.slice(0, MAX_ANSWER_CHARS) : text;
}

/**
 * The instruction appended to every prompt.
 *
 * Two jobs. It asks for the shape the analyser reads best — an ordered list of
 * named businesses — and it forbids the hedge ("I can't browse", "I don't have
 * real-time data") that would otherwise be recorded as a legitimate answer in
 * which the brand simply was not mentioned.
 *
 * Deliberately does NOT name the brand being measured. Mentioning it would
 * prime the model to include it, which would make the measurement worthless.
 */
export const ANSWER_SHAPE_INSTRUCTION =
  "Answer as you normally would for a real person asking this. " +
  "Give a numbered list of specific named businesses, best first, one short line each. " +
  "Use real business names, not placeholders or categories. " +
  "If you genuinely cannot name any, say exactly: NO_RESULTS.";

/** Prompt text as sent, including the shape instruction. */
export function withAnswerShape(promptText: string): string {
  return `${promptText}\n\n${ANSWER_SHAPE_INSTRUCTION}`;
}

/** True when the assistant declined rather than answered. Such a check is
 *  recorded but must not count as "we were not mentioned", because nobody was. */
export function isNoResultsAnswer(text: string): boolean {
  const t = (text || "").trim().toLowerCase();
  if (!t) return true;
  return t === "no_results" || t.startsWith("no_results");
}
