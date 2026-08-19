import { test, expect, beforeEach, afterEach } from "vitest";
import {
  PROVIDERS,
  availableProviders,
  isNoResultsAnswer,
  providerById,
  selectedProviders,
  timedAnswer,
  truncateAnswer,
  withAnswerShape,
  MAX_ANSWER_CHARS,
} from "./index";
import { toSearchQuery } from "./ai-overviews";

const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "PERPLEXITY_API_KEY",
  "DATAFORSEO_LOGIN",
  "DATAFORSEO_PASSWORD",
  "AI_VISIBILITY_ASSISTANTS",
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// ── Registry ────────────────────────────────────────────────────────────────
test("every assistant we claim to support has a provider", () => {
  expect(PROVIDERS.map((p) => p.id).sort()).toEqual([
    "ai_overview",
    "claude",
    "gemini",
    "openai",
    "perplexity",
  ]);
});

test("every provider declares which credential switches it on", () => {
  for (const p of PROVIDERS) {
    expect(p.requires, p.id).toBeTruthy();
    expect(p.label, p.id).toBeTruthy();
  }
});

test("providerById resolves a known id and rejects an unknown one", () => {
  expect(providerById("claude")?.label).toBe("Claude");
  expect(providerById("nope" as never)).toBeNull();
});

// ── Availability gating ─────────────────────────────────────────────────────
test("no credentials means no providers, rather than failing calls later", () => {
  expect(availableProviders()).toEqual([]);
});

test("a provider becomes available when its credential is present", () => {
  process.env.ANTHROPIC_API_KEY = "x";
  expect(availableProviders().map((p) => p.id)).toEqual(["claude"]);
});

test("Google AI Overviews needs both DataForSEO credentials", () => {
  process.env.DATAFORSEO_LOGIN = "user";
  expect(availableProviders()).toEqual([]);
  process.env.DATAFORSEO_PASSWORD = "pass";
  expect(availableProviders().map((p) => p.id)).toEqual(["ai_overview"]);
});

test("AI_VISIBILITY_ASSISTANTS narrows the set without removing a shared key", () => {
  // The Gemini key also drives image generation, so capping spend has to be
  // possible without deleting it.
  process.env.ANTHROPIC_API_KEY = "x";
  process.env.GEMINI_API_KEY = "y";
  expect(selectedProviders().map((p) => p.id).sort()).toEqual(["claude", "gemini"]);

  process.env.AI_VISIBILITY_ASSISTANTS = "claude";
  expect(selectedProviders().map((p) => p.id)).toEqual(["claude"]);
});

test("selecting an unconfigured assistant yields nothing rather than a broken call", () => {
  process.env.ANTHROPIC_API_KEY = "x";
  process.env.AI_VISIBILITY_ASSISTANTS = "openai";
  expect(selectedProviders()).toEqual([]);
});

// ── Prompt shaping ──────────────────────────────────────────────────────────
test("the shape instruction is appended without naming the brand", () => {
  // Naming the measured brand would prime the model to include it and make the
  // whole measurement worthless.
  const shaped = withAnswerShape("best junk removal in Calgary");
  expect(shaped.startsWith("best junk removal in Calgary")).toBe(true);
  expect(shaped).toContain("numbered list");
  expect(shaped).toContain("NO_RESULTS");
});

test("a declined answer is recognised so it is not scored as a miss", () => {
  expect(isNoResultsAnswer("NO_RESULTS")).toBe(true);
  expect(isNoResultsAnswer("no_results — I cannot browse")).toBe(true);
  expect(isNoResultsAnswer("")).toBe(true);
  expect(isNoResultsAnswer("1. Junk Free")).toBe(false);
});

test("answers are capped so one verbose reply cannot bloat the table", () => {
  const long = "x".repeat(MAX_ANSWER_CHARS + 500);
  expect(truncateAnswer(long)).toHaveLength(MAX_ANSWER_CHARS);
  expect(truncateAnswer("short")).toBe("short");
});

// ── Failure handling ────────────────────────────────────────────────────────
test("a provider failure becomes a recorded error, never a thrown exception", () => {
  // The check still has to be written, so an outage is visible in the data
  // instead of looking like lost visibility.
  return timedAnswer("claude", "m", async () => {
    throw new Error("429 rate limited");
  }).then((answer) => {
    expect(answer.error).toContain("429");
    expect(answer.text).toBe("");
    expect(answer.citations).toEqual([]);
    expect(answer.assistant).toBe("claude");
    expect(answer.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

test("a successful call reports no error and keeps its citations", async () => {
  const answer = await timedAnswer("gemini", "gemini-2.5-flash", async () => ({
    text: "1. Junk Free",
    citations: [{ url: "https://junkfree.ca", title: null, position: 1 }],
  }));
  expect(answer.error).toBeNull();
  expect(answer.text).toBe("1. Junk Free");
  expect(answer.citations).toHaveLength(1);
});

// ── AI Overview query conversion ────────────────────────────────────────────
test("a conversational prompt is condensed into a typed search query", () => {
  // A SERP is a different medium from a chat turn; sending the full sentence
  // would measure a search result nobody sees.
  expect(toSearchQuery("Who should I hire for junk removal in Calgary?")).toBe("junk removal in Calgary");
  expect(toSearchQuery("What are the top 5 junk removal companies in Calgary?")).toBe("junk removal in Calgary");
  expect(toSearchQuery("How much does junk removal cost in Calgary, and who offers good value?")).toBe(
    "junk removal cost in Calgary"
  );
});

test("an already-short query passes through unchanged", () => {
  expect(toSearchQuery("best junk removal in Calgary")).toBe("best junk removal in Calgary");
});

test("result nouns are dropped wherever they appear, not only at the end", () => {
  // A person types "junk removal in Calgary", never "junk removal companies in
  // Calgary". The word used to survive because it was mid-string.
  expect(toSearchQuery("Which junk removal company in Calgary is the most reliable and trustworthy?")).toBe(
    "junk removal in Calgary"
  );
  expect(toSearchQuery("I need junk removal in Calgary. Which companies do you recommend?")).toBe(
    "junk removal in Calgary"
  );
});

test("conversion never leaves dangling punctuation", () => {
  for (const prompt of [
    "How much does junk removal cost in Calgary, and who offers good value?",
    "What are the top 5 junk removal companies in Calgary?",
    "What are the alternatives to GotJunk for junk removal in Calgary?",
  ]) {
    const q = toSearchQuery(prompt);
    expect(q, prompt).not.toMatch(/^[\s,]|[\s,]$/);
    expect(q, prompt).not.toContain("  ");
  }
});

test("the query is bounded", () => {
  expect(toSearchQuery("best " + "x".repeat(300)).length).toBeLessThanOrEqual(120);
});
