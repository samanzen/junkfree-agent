import { test, expect } from "vitest";
import {
  assistantLabel,
  emptyBody,
  emptyTitle,
  formatPct,
  formatWhen,
  hasConfiguredAssistants,
  intentLabel,
  languageLabel,
  namedIn,
  ofSample,
  rateTone,
} from "./display";

test("openai is labelled ChatGPT, not OpenAI", () => {
  expect(assistantLabel("openai")).toBe("ChatGPT");
  expect(assistantLabel("ai_overview")).toBe("Google AI Overview");
  expect(assistantLabel("unknown-bot")).toBe("unknown-bot");
});

test("the mention rate is always a count, never a lone percentage", () => {
  expect(namedIn(6, 12)).toBe("Named in 6 of 12");
  expect(namedIn(0, 8)).toBe("Named in 0 of 8");
  expect(namedIn(0, 0)).toBe("No scored answers yet");
  expect(ofSample(6, 12)).toBe("6 of 12");
});

test("percentages keep a single decimal only when they need it", () => {
  expect(formatPct(50)).toBe("50%");
  expect(formatPct(33.3)).toBe("33.3%");
  expect(formatPct(null)).toBe("—");
});

test("rate tone treats a missing sample as muted, not a zero", () => {
  expect(rateTone(null)).toBe("m");
  expect(rateTone(50)).toBe("g");
  expect(rateTone(25)).toBe("a");
  expect(rateTone(10)).toBe("b");
});

test("intent and language labels are human words", () => {
  expect(intentLabel("proximity")).toBe("Nearby");
  expect(intentLabel(null)).toBe("—");
  expect(languageLabel("fr")).toMatch(/French/i);
  expect(languageLabel(null)).toBe("—");
});

test("a missing timestamp does not throw", () => {
  expect(formatWhen(null)).toBe("—");
  expect(formatWhen("not-a-date")).toBe("—");
});

test("customer empty-states never mention the migration or the keys", () => {
  const migrated = emptyBody("not_migrated", false, "customer");
  const none = emptyBody("no_runs", false, "customer");
  expect(migrated).not.toMatch(/sql|migration|supabase|API|key/i);
  expect(none).not.toMatch(/sql|ANTHROPIC|GEMINI|DataForSEO|API/i);
  expect(emptyTitle("not_migrated", false)).toBe("AI visibility is not enabled yet");
});

test("admin empty-states tell the operator what to do", () => {
  expect(emptyBody("not_migrated", true, "admin")).toMatch(/018_ai_visibility\.sql/);
  expect(emptyBody("no_runs", false, "admin")).toMatch(/ANTHROPIC_API_KEY/);
  expect(emptyBody("no_runs", true, "admin")).toMatch(/Run one now/);
});

test("hasConfiguredAssistants is false when the list is empty or all off", () => {
  expect(hasConfiguredAssistants([])).toBe(false);
  expect(hasConfiguredAssistants([{ id: "claude", label: "Claude", requires: "X", available: false }])).toBe(false);
  expect(hasConfiguredAssistants([{ id: "claude", label: "Claude", requires: "X", available: true }])).toBe(true);
});
