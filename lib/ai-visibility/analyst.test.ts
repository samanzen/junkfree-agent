import { test, expect } from "vitest";
import { prioritiseGaps, summariseChecks } from "./analyst";

type Row = Parameters<typeof summariseChecks>[0][number];

let seq = 0;
function row(overrides: Partial<Row> = {}): Row {
  seq++;
  return {
    prompt_key: `p${seq}`,
    prompt_text: `question ${seq}`,
    intent: "discovery",
    language: "en",
    locale_label: "Calgary",
    city: "Calgary",
    assistant: "claude",
    mentioned: true,
    rank: 1,
    brands_named: [{ name: "Junk Free", rank: 1, isOwn: true }],
    error: null,
    ...overrides,
  };
}

test("gaps are the scorable checks where we were absent", () => {
  const rows = [
    row({ prompt_key: "won", mentioned: true }),
    row({ prompt_key: "lost", mentioned: false, brands_named: [{ name: "Rival A", rank: 1, isOwn: false }] }),
    row({ prompt_key: "errored", mentioned: false, error: "timeout" }),
    row({ prompt_key: "declined", mentioned: false, brands_named: [] }),
  ];
  const { gaps, scorable, mentioned } = summariseChecks(rows);
  expect(gaps.map((g) => g.promptKey)).toEqual(["lost"]);
  expect(gaps[0].competitorsNamed).toEqual(["Rival A"]);
  expect(scorable).toBe(2);
  expect(mentioned).toBe(1);
});

test("rivals are ranked by how often they beat us, not just how often they appear", () => {
  const rows = [
    // Appears twice but never against us.
    row({ mentioned: true, brands_named: [{ name: "Everywhere Co", rank: 2, isOwn: false }, { name: "Junk Free", rank: 1, isOwn: true }] }),
    row({ mentioned: true, brands_named: [{ name: "Everywhere Co", rank: 2, isOwn: false }, { name: "Junk Free", rank: 1, isOwn: true }] }),
    // Appears once, and we are absent.
    row({ mentioned: false, brands_named: [{ name: "Beats Us", rank: 1, isOwn: false }] }),
  ];
  const { rivals } = summariseChecks(rows);
  expect(rivals[0].name).toBe("Beats Us");
  expect(rivals[0].wonAgainstUs).toBe(1);
  expect(rivals[1].name).toBe("Everywhere Co");
  expect(rivals[1].appearances).toBe(2);
  expect(rivals[1].wonAgainstUs).toBe(0);
});

test("a rival's best rank is tracked across appearances", () => {
  const rows = [
    row({ mentioned: false, brands_named: [{ name: "Rival", rank: 3, isOwn: false }] }),
    row({ mentioned: false, brands_named: [{ name: "Rival", rank: 1, isOwn: false }] }),
  ];
  expect(summariseChecks(rows).rivals[0].bestRank).toBe(1);
});

test("a gap agreed on by more assistants is prioritised", () => {
  // Losing on one assistant is more likely that assistant's idiosyncrasy;
  // losing on all of them is a content problem worth writing for.
  const gaps = [
    { promptKey: "one", promptText: "one", intent: null, assistant: "claude", language: "en", localeLabel: null, city: null, competitorsNamed: [] },
    { promptKey: "all", promptText: "all", intent: null, assistant: "claude", language: "en", localeLabel: null, city: null, competitorsNamed: [] },
    { promptKey: "all", promptText: "all", intent: null, assistant: "gemini", language: "en", localeLabel: null, city: null, competitorsNamed: [] },
    { promptKey: "all", promptText: "all", intent: null, assistant: "openai", language: "en", localeLabel: null, city: null, competitorsNamed: [] },
  ];
  const priority = prioritiseGaps(gaps);
  expect(priority[0].promptKey).toBe("all");
  expect(priority[0].assistantsMissing).toBe(3);
});

test("the same prompt is never queued twice from one sweep", () => {
  const gaps = ["claude", "gemini"].map((assistant) => ({
    promptKey: "same",
    promptText: "same",
    intent: null,
    assistant,
    language: "en",
    localeLabel: null,
    city: null,
    competitorsNamed: [],
  }));
  expect(prioritiseGaps(gaps)).toHaveLength(1);
});

test("prioritisation is bounded, so a bad week cannot flood the queue", () => {
  const gaps = Array.from({ length: 20 }, (_, i) => ({
    promptKey: `p${i}`,
    promptText: `q${i}`,
    intent: null,
    assistant: "claude",
    language: "en",
    localeLabel: null,
    city: null,
    competitorsNamed: [],
  }));
  expect(prioritiseGaps(gaps).length).toBeLessThanOrEqual(2);
});

test("prioritisation is deterministic for equally-missing gaps", () => {
  const gaps = ["b", "a"].map((k) => ({
    promptKey: k, promptText: k, intent: null, assistant: "claude",
    language: "en", localeLabel: null, city: null, competitorsNamed: [],
  }));
  expect(prioritiseGaps(gaps, 2).map((g) => g.promptKey)).toEqual(["a", "b"]);
});

test("an empty run summarises to nothing rather than throwing", () => {
  const { gaps, rivals, scorable, mentioned } = summariseChecks([]);
  expect(gaps).toEqual([]);
  expect(rivals).toEqual([]);
  expect(scorable).toBe(0);
  expect(mentioned).toBe(0);
});
