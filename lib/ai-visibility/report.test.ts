import { test, expect } from "vitest";
import {
  buildReport,
  byAssistant,
  byCity,
  byPrompt,
  citedDomains,
  citedOwnPages,
  competitorShare,
  health,
  isScorable,
  trend,
} from "./report";
import type { CheckRow, CitationRow, RunRow } from "./report";

let seq = 0;
function check(overrides: Partial<CheckRow> = {}): CheckRow {
  seq++;
  return {
    id: `c${seq}`,
    prompt_key: "discovery-best|junk-removal|calgary|en",
    prompt_text: "best junk removal in Calgary",
    intent: "discovery",
    language: "en",
    country: "Canada",
    region: "Alberta",
    city: "Calgary",
    neighborhood: null,
    locale_label: "Calgary, Alberta, Canada",
    assistant: "claude",
    model: "claude-sonnet-5",
    mentioned: true,
    rank: 1,
    brands_named: [{ name: "Junk Free", rank: 1, isOwn: true }],
    sentiment: "positive",
    share_of_voice: 100,
    latency_ms: 1000,
    error: null,
    checked_at: `2026-08-0${(seq % 9) + 1}T00:00:00.000Z`,
    ...overrides,
  };
}

// ── The scoring rule ────────────────────────────────────────────────────────
test("an errored check is not scorable", () => {
  // A vendor outage must never read as lost visibility.
  expect(isScorable(check({ error: "timeout", mentioned: false }))).toBe(false);
});

test("a check where the assistant named nobody is not scorable", () => {
  // Nobody was mentioned, so counting it as a miss would punish the brand for a
  // question the assistant refused to answer.
  expect(isScorable(check({ brands_named: [], mentioned: false }))).toBe(false);
});

test("rates exclude unscorable checks from the denominator", () => {
  const rows = [
    check({ mentioned: true }),
    check({ mentioned: false, brands_named: [{ name: "Rival", rank: 1, isOwn: false }] }),
    check({ mentioned: false, error: "timeout" }),
    check({ mentioned: false, brands_named: [] }),
  ];
  const report = buildReport(rows, [], []);
  expect(report.overall.scorable).toBe(2);
  expect(report.overall.mentioned).toBe(1);
  expect(report.overall.rate).toBe(50);
});

test("a rate is null rather than zero when there is nothing to score", () => {
  // Zero would claim we measured and found nothing; null says we did not measure.
  const report = buildReport([check({ error: "boom" })], [], []);
  expect(report.overall.rate).toBeNull();
  expect(report.overall.scorable).toBe(0);
});

// ── Per assistant ───────────────────────────────────────────────────────────
test("each assistant gets its own rate, rank and latency", () => {
  const rows = [
    check({ assistant: "claude", mentioned: true, rank: 1, latency_ms: 1000 }),
    check({ assistant: "claude", mentioned: true, rank: 3, latency_ms: 3000 }),
    check({ assistant: "gemini", mentioned: false, rank: null, brands_named: [{ name: "Rival", isOwn: false }] }),
  ];
  const rows2 = byAssistant(rows);
  const claude = rows2.find((r) => r.assistant === "claude")!;
  const gemini = rows2.find((r) => r.assistant === "gemini")!;

  expect(claude.rate).toBe(100);
  expect(claude.avgRank).toBe(2);
  expect(claude.avgLatencyMs).toBe(2000);
  expect(gemini.rate).toBe(0);
  expect(gemini.avgRank).toBeNull();
});

// ── Per prompt ──────────────────────────────────────────────────────────────
test("a prompt row carries every assistant's outcome and the rivals named", () => {
  const rows = [
    check({
      prompt_key: "p1", assistant: "claude", mentioned: false, rank: null,
      brands_named: [{ name: "Rival A", rank: 1, isOwn: false }, { name: "Rival B", rank: 2, isOwn: false }],
    }),
    check({ prompt_key: "p1", assistant: "gemini", mentioned: true, rank: 2, brands_named: [{ name: "Rival A", rank: 1, isOwn: false }, { name: "Junk Free", rank: 2, isOwn: true }] }),
  ];
  const [p] = byPrompt(rows);
  expect(p.scorable).toBe(2);
  expect(p.mentioned).toBe(1);
  expect(p.rate).toBe(50);
  expect(p.bestRank).toBe(2);
  expect(p.perAssistant.map((a) => a.assistant).sort()).toEqual(["claude", "gemini"]);
  expect(p.competitorsNamed.sort()).toEqual(["Rival A", "Rival B"]);
});

test("prompts are ordered worst first, because the report exists to show what to fix", () => {
  const rows = [
    check({ prompt_key: "won", prompt_text: "won", mentioned: true }),
    check({ prompt_key: "lost", prompt_text: "lost", mentioned: false, brands_named: [{ name: "R", isOwn: false }] }),
  ];
  expect(byPrompt(rows).map((p) => p.promptKey)).toEqual(["lost", "won"]);
});

test("gaps are the prompts no assistant named us in", () => {
  const rows = [
    check({ prompt_key: "lost", mentioned: false, brands_named: [{ name: "R", isOwn: false }] }),
    check({ prompt_key: "partly", assistant: "claude", mentioned: false, brands_named: [{ name: "R", isOwn: false }] }),
    check({ prompt_key: "partly", assistant: "gemini", mentioned: true }),
  ];
  expect(buildReport(rows, [], []).gaps.map((g) => g.promptKey)).toEqual(["lost"]);
});

// ── Places ──────────────────────────────────────────────────────────────────
test("places segment independently of each other", () => {
  const rows = [
    check({ city: "Calgary", mentioned: true }),
    check({ city: "Airdrie", mentioned: false, brands_named: [{ name: "R", isOwn: false }] }),
  ];
  const cities = byCity(rows);
  expect(cities.find((c) => c.segment === "Calgary")!.rate).toBe(100);
  expect(cities.find((c) => c.segment === "Airdrie")!.rate).toBe(0);
});

test("rows with no value for a segment are dropped rather than bucketed as empty", () => {
  expect(byCity([check({ city: null })])).toEqual([]);
});

// ── Competitors ─────────────────────────────────────────────────────────────
test("a rival's wins against us are counted separately from appearances", () => {
  const rows = [
    check({
      mentioned: false,
      brands_named: [{ name: "Rival A", rank: 1, isOwn: false }],
    }),
    check({
      mentioned: true,
      brands_named: [{ name: "Rival A", rank: 2, isOwn: false }, { name: "Junk Free", rank: 1, isOwn: true }],
    }),
  ];
  const [rival] = competitorShare(rows);
  expect(rival.name).toBe("Rival A");
  expect(rival.appearances).toBe(2);
  expect(rival.wonAgainstUs).toBe(1);
  expect(rival.bestRank).toBe(1);
  expect(rival.avgRank).toBe(1.5);
});

test("our own brand is never counted as a competitor", () => {
  const rows = [check({ brands_named: [{ name: "Junk Free", rank: 1, isOwn: true }] })];
  expect(competitorShare(rows)).toEqual([]);
});

test("unscorable checks do not feed the competitor picture", () => {
  const rows = [check({ error: "boom", brands_named: [{ name: "Rival", isOwn: false }] })];
  expect(competitorShare(rows)).toEqual([]);
});

// ── Citations ───────────────────────────────────────────────────────────────
test("our cited pages are rolled up with the assistants and questions behind them", () => {
  const a = check({ assistant: "claude", prompt_text: "best junk removal in Calgary" });
  const b = check({ assistant: "gemini", prompt_text: "who should I hire" });
  const citations: CitationRow[] = [
    { check_id: a.id, url: "https://junkfree.ca/calgary", domain: "junkfree.ca", title: "Calgary", is_own: true },
    { check_id: b.id, url: "https://junkfree.ca/calgary", domain: "junkfree.ca", title: null, is_own: true },
    { check_id: a.id, url: "https://yelp.ca/x", domain: "yelp.ca", title: null, is_own: false },
  ];

  const pages = citedOwnPages([a, b], citations);
  expect(pages).toHaveLength(1);
  expect(pages[0].citations).toBe(2);
  expect(pages[0].title).toBe("Calgary");
  expect(pages[0].assistants).toEqual(["claude", "gemini"]);
  expect(pages[0].prompts).toHaveLength(2);
});

test("cited domains cover everyone, ours flagged", () => {
  const domains = citedDomains([
    { check_id: "c1", url: "https://yelp.ca/a", domain: "yelp.ca", title: null, is_own: false },
    { check_id: "c1", url: "https://yelp.ca/b", domain: "yelp.ca", title: null, is_own: false },
    { check_id: "c1", url: "https://junkfree.ca/x", domain: "junkfree.ca", title: null, is_own: true },
  ]);
  expect(domains[0]).toEqual({ domain: "yelp.ca", citations: 2, isOwn: false });
  expect(domains[1]).toEqual({ domain: "junkfree.ca", citations: 1, isOwn: true });
});

// ── Trend and health ────────────────────────────────────────────────────────
test("the trend covers finished runs only, oldest first", () => {
  const runs: RunRow[] = [
    { id: "r2", status: "done", mention_rate: "50.00", checks_completed: 4, checks_failed: 0, prompts_planned: 4, assistants: [], started_at: "2026-08-08T00:00:00Z", finished_at: "2026-08-08T00:10:00Z" },
    { id: "r3", status: "running", mention_rate: null, checks_completed: 1, checks_failed: 0, prompts_planned: 4, assistants: [], started_at: "2026-08-15T00:00:00Z", finished_at: null },
    { id: "r1", status: "done", mention_rate: 25, checks_completed: 4, checks_failed: 0, prompts_planned: 4, assistants: [], started_at: "2026-08-01T00:00:00Z", finished_at: "2026-08-01T00:10:00Z" },
  ];
  const points = trend(runs);
  expect(points.map((p) => p.runId)).toEqual(["r1", "r2"]);
  // Postgres numeric arrives as a string; it must still chart as a number.
  expect(points.map((p) => p.mentionRate)).toEqual([25, 50]);
});

test("health separates errors from declines and names the failing assistant", () => {
  const rows = [
    check({ assistant: "gemini", error: "429 rate limited", mentioned: false }),
    check({ assistant: "gemini", error: "timeout", mentioned: false }),
    check({ assistant: "claude", brands_named: [], mentioned: false }),
    check({ assistant: "claude", mentioned: true }),
  ];
  const h = health(rows);
  expect(h.checks).toBe(4);
  expect(h.errors).toBe(2);
  expect(h.declined).toBe(1);
  expect(h.scorable).toBe(1);
  expect(h.errorsByAssistant[0].assistant).toBe("gemini");
  expect(h.errorsByAssistant[0].errors).toBe(2);
});

// ── Whole report ────────────────────────────────────────────────────────────
test("the report holds every axis and never throws on empty input", () => {
  const empty = buildReport([], [], []);
  expect(empty.overall.rate).toBeNull();
  expect(empty.assistants).toEqual([]);
  expect(empty.prompts).toEqual([]);
  expect(empty.gaps).toEqual([]);
  expect(empty.places.cities).toEqual([]);

  const report = buildReport([check()], [], []);
  for (const key of [
    "overall", "trend", "assistants", "prompts", "places", "languages",
    "intents", "competitors", "citedPages", "citedDomains", "sentiment", "gaps", "health",
  ]) {
    expect(report, key).toHaveProperty(key);
  }
});
