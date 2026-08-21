// AI VISIBILITY — report aggregation.
//
// Pure functions over stored check rows. Every number the report shows is
// computed here rather than in the API route, for two reasons: it is unit
// testable without a database, and there is one definition of "mention rate"
// instead of one per surface.
//
// The scoring rule, applied consistently everywhere below:
//
//   A check is SCORABLE when it did not error AND the assistant actually named
//   at least one business. Checks that errored are excluded because a provider
//   outage is not a loss of visibility, and checks where the assistant declined
//   to name anyone are excluded because nobody was mentioned in them — counting
//   those as misses would punish a brand for a question the assistant refused.
//
// Rates are therefore always "of the questions that had an answer to be
// mentioned in", which is the only denominator that means anything.

export type CheckRow = {
  id: string;
  prompt_key: string;
  prompt_text: string;
  intent: string | null;
  language: string;
  country: string | null;
  region: string | null;
  city: string | null;
  neighborhood: string | null;
  locale_label: string | null;
  assistant: string;
  model: string | null;
  mentioned: boolean;
  rank: number | null;
  brands_named: { name?: string; rank?: number; isOwn?: boolean }[] | null;
  sentiment: string | null;
  share_of_voice: number | string | null;
  latency_ms: number | null;
  error: string | null;
  checked_at: string;
};

export type CitationRow = {
  check_id: string;
  url: string;
  domain: string | null;
  title: string | null;
  is_own: boolean;
};

export type RunRow = {
  id: string;
  status: string;
  mention_rate: number | string | null;
  checks_completed: number;
  checks_failed: number;
  prompts_planned: number;
  assistants: unknown;
  started_at: string;
  finished_at: string | null;
};

/** A rate with the counts it came from, so the UI never shows a percentage
 *  without the sample size behind it. */
export type Rate = { mentioned: number; scorable: number; rate: number | null };

function rateOf(rows: CheckRow[]): Rate {
  const scorable = rows.filter(isScorable);
  const mentioned = scorable.filter((r) => r.mentioned).length;
  return {
    mentioned,
    scorable: scorable.length,
    rate: scorable.length ? Math.round((mentioned / scorable.length) * 1000) / 10 : null,
  };
}

export function isScorable(row: CheckRow): boolean {
  return !row.error && Array.isArray(row.brands_named) && row.brands_named.length > 0;
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** Average of the defined values, or null when there are none. */
function average(values: (number | null)[]): number | null {
  const defined = values.filter((v): v is number => v != null);
  if (!defined.length) return null;
  return Math.round((defined.reduce((a, b) => a + b, 0) / defined.length) * 10) / 10;
}

/** Group rows by a key, dropping rows whose key is absent. */
function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const list = m.get(k);
    if (list) list.push(row);
    else m.set(k, [row]);
  }
  return m;
}

// ── Per-assistant: "which channel recommends us" ────────────────────────────
export type AssistantBreakdown = {
  assistant: string;
  model: string | null;
  checks: number;
  errors: number;
  avgRank: number | null;
  avgLatencyMs: number | null;
} & Rate;

export function byAssistant(rows: CheckRow[]): AssistantBreakdown[] {
  return [...groupBy(rows, (r) => r.assistant).entries()]
    .map(([assistant, group]) => ({
      assistant,
      model: group.find((r) => r.model)?.model ?? null,
      checks: group.length,
      errors: group.filter((r) => r.error).length,
      avgRank: average(group.filter((r) => r.mentioned).map((r) => r.rank)),
      avgLatencyMs: average(group.map((r) => r.latency_ms)),
      ...rateOf(group),
    }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.assistant.localeCompare(b.assistant));
}

// ── Per-prompt: "which questions do we win and lose" ────────────────────────
export type PromptBreakdown = {
  promptKey: string;
  promptText: string;
  intent: string | null;
  language: string;
  localeLabel: string | null;
  city: string | null;
  country: string | null;
  /** Per-assistant outcome for this exact question. */
  perAssistant: { assistant: string; mentioned: boolean; rank: number | null; error: string | null }[];
  bestRank: number | null;
  competitorsNamed: string[];
  lastCheckedAt: string;
} & Rate;

export function byPrompt(rows: CheckRow[]): PromptBreakdown[] {
  return [...groupBy(rows, (r) => r.prompt_key).entries()]
    .map(([promptKey, group]) => {
      const newest = [...group].sort((a, b) => b.checked_at.localeCompare(a.checked_at))[0];
      const competitors = new Set<string>();
      for (const row of group) {
        for (const named of row.brands_named || []) {
          if (!named.isOwn && named.name) competitors.add(named.name);
        }
      }
      return {
        promptKey,
        promptText: newest.prompt_text,
        intent: newest.intent,
        language: newest.language,
        localeLabel: newest.locale_label,
        city: newest.city,
        country: newest.country,
        perAssistant: group.map((r) => ({
          assistant: r.assistant,
          mentioned: r.mentioned,
          rank: r.rank,
          error: r.error,
        })),
        bestRank: group.reduce<number | null>(
          (best, r) => (r.rank == null ? best : best == null ? r.rank : Math.min(best, r.rank)),
          null
        ),
        competitorsNamed: [...competitors].slice(0, 8),
        lastCheckedAt: newest.checked_at,
        ...rateOf(group),
      };
    })
    // Worst first: the report's job is to show what to fix.
    .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.promptText.localeCompare(b.promptText));
}

// ── Per-place and per-language ──────────────────────────────────────────────
export type SegmentBreakdown = { segment: string; checks: number } & Rate;

function segment(rows: CheckRow[], key: (r: CheckRow) => string | null): SegmentBreakdown[] {
  return [...groupBy(rows, key).entries()]
    .map(([seg, group]) => ({ segment: seg, checks: group.length, ...rateOf(group) }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.segment.localeCompare(b.segment));
}

export const byCountry = (rows: CheckRow[]) => segment(rows, (r) => r.country);
export const byRegion = (rows: CheckRow[]) => segment(rows, (r) => r.region);
export const byCity = (rows: CheckRow[]) => segment(rows, (r) => r.city);
export const byNeighborhood = (rows: CheckRow[]) => segment(rows, (r) => r.neighborhood);
export const byLanguage = (rows: CheckRow[]) => segment(rows, (r) => r.language);
export const byIntent = (rows: CheckRow[]) => segment(rows, (r) => r.intent);

// ── Competitors: "who gets recommended instead of us" ───────────────────────
export type CompetitorBreakdown = {
  name: string;
  appearances: number;
  /** Questions where they were named and we were not. */
  wonAgainstUs: number;
  bestRank: number | null;
  avgRank: number | null;
  assistants: string[];
};

export function competitorShare(rows: CheckRow[]): CompetitorBreakdown[] {
  type Acc = {
    name: string;
    appearances: number;
    wonAgainstUs: number;
    ranks: number[];
    assistants: Set<string>;
  };
  const index = new Map<string, Acc>();

  for (const row of rows) {
    if (!isScorable(row)) continue;
    for (const named of row.brands_named || []) {
      if (named.isOwn || !named.name) continue;
      const key = named.name.toLowerCase();
      const acc =
        index.get(key) ||
        { name: named.name, appearances: 0, wonAgainstUs: 0, ranks: [] as number[], assistants: new Set<string>() };
      acc.appearances++;
      if (!row.mentioned) acc.wonAgainstUs++;
      if (typeof named.rank === "number") acc.ranks.push(named.rank);
      acc.assistants.add(row.assistant);
      index.set(key, acc);
    }
  }

  return [...index.values()]
    .map((a) => ({
      name: a.name,
      appearances: a.appearances,
      wonAgainstUs: a.wonAgainstUs,
      bestRank: a.ranks.length ? Math.min(...a.ranks) : null,
      avgRank: a.ranks.length ? Math.round((a.ranks.reduce((x, y) => x + y, 0) / a.ranks.length) * 10) / 10 : null,
      assistants: [...a.assistants].sort(),
    }))
    .sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name));
}

// ── Citations: "which of our pages earns the recommendation" ────────────────
export type CitedPage = {
  url: string;
  title: string | null;
  citations: number;
  assistants: string[];
  /** Questions this page was cited for. */
  prompts: string[];
};

export function citedOwnPages(rows: CheckRow[], citations: CitationRow[]): CitedPage[] {
  const rowById = new Map(rows.map((r) => [r.id, r]));
  type Acc = { url: string; title: string | null; citations: number; assistants: Set<string>; prompts: Set<string> };
  const index = new Map<string, Acc>();

  for (const c of citations) {
    if (!c.is_own) continue;
    const check = rowById.get(c.check_id);
    const acc =
      index.get(c.url) ||
      { url: c.url, title: c.title, citations: 0, assistants: new Set<string>(), prompts: new Set<string>() };
    acc.citations++;
    if (!acc.title && c.title) acc.title = c.title;
    if (check) {
      acc.assistants.add(check.assistant);
      acc.prompts.add(check.prompt_text);
    }
    index.set(c.url, acc);
  }

  return [...index.values()]
    .map((a) => ({
      url: a.url,
      title: a.title,
      citations: a.citations,
      assistants: [...a.assistants].sort(),
      prompts: [...a.prompts].slice(0, 6),
    }))
    .sort((a, b) => b.citations - a.citations || a.url.localeCompare(b.url));
}

/** Domains assistants cite most, ours included, so "who owns the sources" is
 *  visible next to "who gets named". They are different questions: a directory
 *  can dominate citations without being recommended as a business. */
export type CitedDomain = { domain: string; citations: number; isOwn: boolean };

export function citedDomains(citations: CitationRow[], limit = 20): CitedDomain[] {
  const index = new Map<string, CitedDomain>();
  for (const c of citations) {
    if (!c.domain) continue;
    const acc = index.get(c.domain) || { domain: c.domain, citations: 0, isOwn: c.is_own };
    acc.citations++;
    acc.isOwn = acc.isOwn || c.is_own;
    index.set(c.domain, acc);
  }
  return [...index.values()]
    .sort((a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain))
    .slice(0, limit);
}

// ── Trend ───────────────────────────────────────────────────────────────────
export type TrendPoint = {
  runId: string;
  startedAt: string;
  mentionRate: number | null;
  checks: number;
  failed: number;
};

export function trend(runs: RunRow[]): TrendPoint[] {
  return runs
    .filter((r) => r.status === "done")
    .map((r) => ({
      runId: r.id,
      startedAt: r.started_at,
      mentionRate: num(r.mention_rate),
      checks: r.checks_completed,
      failed: r.checks_failed,
    }))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

// ── Sentiment ───────────────────────────────────────────────────────────────
export type SentimentSplit = { positive: number; neutral: number; negative: number };

export function sentimentSplit(rows: CheckRow[]): SentimentSplit {
  const split: SentimentSplit = { positive: 0, neutral: 0, negative: 0 };
  for (const row of rows) {
    if (row.sentiment === "positive") split.positive++;
    else if (row.sentiment === "negative") split.negative++;
    else if (row.sentiment === "neutral") split.neutral++;
  }
  return split;
}

// ── Health ──────────────────────────────────────────────────────────────────
/** Operational state, kept separate from the visibility numbers so a vendor
 *  outage is never read as a ranking change. */
export type ReportHealth = {
  checks: number;
  errors: number;
  declined: number;
  scorable: number;
  errorsByAssistant: { assistant: string; errors: number; lastError: string | null }[];
};

export function health(rows: CheckRow[]): ReportHealth {
  const errored = rows.filter((r) => !!r.error);
  const declined = rows.filter((r) => !r.error && (!Array.isArray(r.brands_named) || r.brands_named.length === 0));

  const errorsByAssistant = [...groupBy(errored, (r) => r.assistant).entries()]
    .map(([assistant, group]) => ({
      assistant,
      errors: group.length,
      lastError: [...group].sort((a, b) => b.checked_at.localeCompare(a.checked_at))[0]?.error ?? null,
    }))
    .sort((a, b) => b.errors - a.errors);

  return {
    checks: rows.length,
    errors: errored.length,
    declined: declined.length,
    scorable: rows.filter(isScorable).length,
    errorsByAssistant,
  };
}

// ── The whole report ────────────────────────────────────────────────────────
export type VisibilityReport = {
  overall: Rate & { avgRank: number | null; avgShareOfVoice: number | null };
  trend: TrendPoint[];
  assistants: AssistantBreakdown[];
  prompts: PromptBreakdown[];
  places: {
    countries: SegmentBreakdown[];
    regions: SegmentBreakdown[];
    cities: SegmentBreakdown[];
    neighborhoods: SegmentBreakdown[];
  };
  languages: SegmentBreakdown[];
  intents: SegmentBreakdown[];
  competitors: CompetitorBreakdown[];
  citedPages: CitedPage[];
  citedDomains: CitedDomain[];
  sentiment: SentimentSplit;
  /** Questions where no assistant named us — the actionable list. */
  gaps: PromptBreakdown[];
  health: ReportHealth;
};

export function buildReport(rows: CheckRow[], citations: CitationRow[], runs: RunRow[]): VisibilityReport {
  const prompts = byPrompt(rows);
  const scorable = rows.filter(isScorable);

  return {
    overall: {
      ...rateOf(rows),
      avgRank: average(scorable.filter((r) => r.mentioned).map((r) => r.rank)),
      avgShareOfVoice: average(scorable.map((r) => num(r.share_of_voice))),
    },
    trend: trend(runs),
    assistants: byAssistant(rows),
    prompts,
    places: {
      countries: byCountry(rows),
      regions: byRegion(rows),
      cities: byCity(rows),
      neighborhoods: byNeighborhood(rows),
    },
    languages: byLanguage(rows),
    intents: byIntent(rows),
    competitors: competitorShare(rows),
    citedPages: citedOwnPages(rows, citations),
    citedDomains: citedDomains(citations),
    sentiment: sentimentSplit(rows),
    gaps: prompts.filter((p) => p.scorable > 0 && p.mentioned === 0),
    health: health(rows),
  };
}
