// AI VISIBILITY — the analyst.
//
// Measurement on its own changes nothing. This is the agent that closes the
// loop: it reads the finished sweep and turns it into (a) lessons the Strategist
// reads on every subsequent run, and (b) concrete queued work.
//
// It plugs into machinery that already exists rather than inventing a parallel
// one. lib/learning.ts writes rows to `lessons` and activeLessons() feeds the
// most recent fifteen into stepPlan's prompt, so a lesson written here genuinely
// steers what the platform decides to build next. Queued work goes through the
// same `enqueue` the auditor uses to raise content fixes.
//
// The rule followed throughout: only act on evidence in the data. Every lesson
// and every queued task names the prompt, the assistant and the place it came
// from, so a human reading it in the Debrief can agree or push back on a
// specific claim rather than a vague one.

import { db } from "../supabase";
import type { Brand } from "../brands";
import { enqueue } from "../queue";
import { callClaude, extractJSON } from "../anthropic";
import { brandBlock } from "../brands";
import { isMissingMigration } from "./store";

/** A prompt where we were absent, with the rivals that took the slot. */
export type VisibilityGap = {
  promptKey: string;
  promptText: string;
  intent: string | null;
  assistant: string;
  language: string;
  localeLabel: string | null;
  city: string | null;
  competitorsNamed: string[];
};

/** A rival's presence across the sweep. */
export type RivalPresence = {
  name: string;
  appearances: number;
  bestRank: number | null;
  /** Prompts where they appeared and we did not. */
  wonAgainstUs: number;
};

type CheckRow = {
  prompt_key: string;
  prompt_text: string;
  intent: string | null;
  language: string;
  locale_label: string | null;
  city: string | null;
  assistant: string;
  mentioned: boolean;
  rank: number | null;
  brands_named: { name?: string; rank?: number; isOwn?: boolean }[] | null;
  error: string | null;
};

/** How many gaps a single sweep is allowed to act on. Bounded for the same
 *  reason MAX_TASKS_PER_RUN is: the site should grow at a natural pace. */
const MAX_ACTIONS = 2;

/**
 * Read one run's checks and derive the gaps and the rival picture.
 *
 * Pure aggregation over rows — no model call — so the numbers in a lesson are
 * always traceable to checks a human can open.
 */
export function summariseChecks(rows: CheckRow[]): {
  gaps: VisibilityGap[];
  rivals: RivalPresence[];
  scorable: number;
  mentioned: number;
} {
  const scorableRows = rows.filter(
    (r) => !r.error && Array.isArray(r.brands_named) && r.brands_named.length > 0
  );

  const gaps: VisibilityGap[] = scorableRows
    .filter((r) => !r.mentioned)
    .map((r) => ({
      promptKey: r.prompt_key,
      promptText: r.prompt_text,
      intent: r.intent,
      assistant: r.assistant,
      language: r.language,
      localeLabel: r.locale_label,
      city: r.city,
      competitorsNamed: (r.brands_named || [])
        .filter((b) => !b.isOwn && !!b.name)
        .slice(0, 5)
        .map((b) => b.name as string),
    }));

  const rivalIndex = new Map<string, RivalPresence>();
  for (const row of scorableRows) {
    for (const named of row.brands_named || []) {
      if (named.isOwn || !named.name) continue;
      const key = named.name.toLowerCase();
      const existing = rivalIndex.get(key) || {
        name: named.name,
        appearances: 0,
        bestRank: null as number | null,
        wonAgainstUs: 0,
      };
      existing.appearances++;
      if (typeof named.rank === "number") {
        existing.bestRank = existing.bestRank == null ? named.rank : Math.min(existing.bestRank, named.rank);
      }
      if (!row.mentioned) existing.wonAgainstUs++;
      rivalIndex.set(key, existing);
    }
  }

  const rivals = [...rivalIndex.values()].sort(
    (a, b) => b.wonAgainstUs - a.wonAgainstUs || b.appearances - a.appearances
  );

  return {
    gaps,
    rivals,
    scorable: scorableRows.length,
    mentioned: scorableRows.filter((r) => r.mentioned).length,
  };
}

/**
 * Pick the gaps most worth acting on.
 *
 * A prompt we lose on EVERY assistant is a content problem we can fix; one we
 * lose on a single assistant is more likely that assistant's idiosyncrasy, and
 * writing a page for it would be chasing noise. So gaps are grouped by prompt
 * and ranked by how many assistants agree we are absent.
 */
export function prioritiseGaps(gaps: VisibilityGap[], limit = MAX_ACTIONS): (VisibilityGap & { assistantsMissing: number })[] {
  const byPrompt = new Map<string, { gap: VisibilityGap; assistants: Set<string> }>();
  for (const gap of gaps) {
    const entry = byPrompt.get(gap.promptKey) || { gap, assistants: new Set<string>() };
    entry.assistants.add(gap.assistant);
    byPrompt.set(gap.promptKey, entry);
  }

  return [...byPrompt.values()]
    .map((e) => ({ ...e.gap, assistantsMissing: e.assistants.size }))
    .sort((a, b) => b.assistantsMissing - a.assistantsMissing || a.promptKey.localeCompare(b.promptKey))
    .slice(0, limit);
}

/**
 * Analyse a finished run: write lessons, queue work.
 *
 * Called from the queue step once a sweep finalises. Every write is best-effort
 * — a brand whose database predates supabase/018_ai_visibility.sql, or whose AI
 * call fails, still completes its run.
 */
export async function analyseVisibilityRun(brand: Brand, runId: string): Promise<{
  gaps: number;
  lessons: number;
  queued: number;
  skipped?: string;
}> {
  const { data, error } = await db
    .from("ai_visibility_checks")
    .select("prompt_key, prompt_text, intent, language, locale_label, city, assistant, mentioned, rank, brands_named, error")
    .eq("run_id", runId);

  if (error) {
    if (isMissingMigration(error)) return { gaps: 0, lessons: 0, queued: 0, skipped: "not_migrated" };
    return { gaps: 0, lessons: 0, queued: 0, skipped: error.message };
  }

  const rows = (data || []) as CheckRow[];
  if (!rows.length) return { gaps: 0, lessons: 0, queued: 0, skipped: "no checks in run" };

  const { gaps, rivals, scorable, mentioned } = summariseChecks(rows);
  const priority = prioritiseGaps(gaps);

  // ── Lessons ───────────────────────────────────────────────────────────────
  // Written from the data, not from a model, so the claim in a lesson is always
  // checkable. The model is used below only to turn them into strategy, never
  // to state the facts.
  const lessons: string[] = [];

  if (scorable > 0) {
    const rate = Math.round((mentioned / scorable) * 100);
    lessons.push(
      `AI assistants named us in ${mentioned} of ${scorable} measured questions (${rate}%). ` +
        `Prioritise answer-shaped content for the questions we lose.`
    );
  }

  const topRival = rivals[0];
  if (topRival && topRival.wonAgainstUs >= 2) {
    lessons.push(
      `${topRival.name} is recommended by AI assistants in ${topRival.wonAgainstUs} question(s) where we are absent. ` +
        `Study what their pages answer that ours do not.`
    );
  }

  for (const gap of priority) {
    const where = gap.localeLabel ? ` for ${gap.localeLabel}` : "";
    const rivalNames = gap.competitorsNamed.slice(0, 3).join(", ");
    lessons.push(
      `We are not named when someone asks "${gap.promptText}"${where} ` +
        `(missing on ${gap.assistantsMissing} assistant(s))${rivalNames ? `; recommended instead: ${rivalNames}` : ""}. ` +
        `Content that answers this question directly is the fix.`
    );
  }

  let lessonsWritten = 0;
  for (const lesson of lessons.slice(0, 5)) {
    const { error: insertErr } = await db.from("lessons").insert({ brand_id: brand.id, lesson });
    if (!insertErr) lessonsWritten++;
  }

  // ── Queued work ───────────────────────────────────────────────────────────
  // A prompt we lose across assistants becomes a real content task, targeted at
  // the question itself. geo_answers is the right agent for this: it writes
  // answer-optimised content, which is exactly what an assistant quotes.
  let queued = 0;
  for (const gap of priority) {
    const rationale =
      `AI visibility: we are not named when someone asks "${gap.promptText}"` +
      (gap.localeLabel ? ` (${gap.localeLabel})` : "") +
      `, missing on ${gap.assistantsMissing} assistant(s)` +
      (gap.competitorsNamed.length ? `; recommended instead: ${gap.competitorsNamed.slice(0, 3).join(", ")}` : "") +
      ". Answer this question directly and factually so assistants can quote it.";

    await enqueue(brand.id, "geo", {
      reason: "ai_visibility_gap",
      prompt_key: gap.promptKey,
      question: gap.promptText,
      locale: gap.localeLabel,
      language: gap.language,
      rationale,
    });
    queued++;
  }

  // ── Strategy note ─────────────────────────────────────────────────────────
  // One short model call to turn the numbers into a paragraph the customer can
  // read in the report. Cached in `reports`, the same pattern the exec summary
  // uses, and entirely optional — a failure leaves the numbers to speak for
  // themselves.
  if (scorable > 0) {
    const summary = await callClaude({
      maxTokens: 700,
      thinking: { type: "disabled" },
      label: "ai-visibility/analyst",
      user: `${brandBlock(brand)}

You are reviewing how often AI assistants recommend this business when people ask for its services.

MEASURED: named in ${mentioned} of ${scorable} questions.
QUESTIONS WE LOSE (with who was recommended instead):
${priority.map((g) => `- "${g.promptText}"${g.localeLabel ? ` [${g.localeLabel}]` : ""} -> ${g.competitorsNamed.slice(0, 3).join(", ") || "no named rivals"}`).join("\n") || "- none"}
RIVALS MOST OFTEN RECOMMENDED INSTEAD: ${rivals.slice(0, 5).map((r) => `${r.name} (${r.wonAgainstUs})`).join(", ") || "none"}

Write 3-4 sentences for the business owner explaining what this means and the single most useful thing to do next. Plain language, no SEO jargon, no invented numbers. Return ONLY JSON: {"summary":"..."}`,
    }).catch(() => null);

    const parsed = extractJSON<{ summary: string }>(summary || "");
    if (parsed?.summary) {
      await db.from("reports").insert({
        brand_id: brand.id,
        section: "ai_visibility_summary",
        summary: parsed.summary,
        cache_expires_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      });
    }
  }

  console.log(
    `[ai-visibility] ${brand.slug}: analyst — ${gaps.length} gap(s), ${lessonsWritten} lesson(s), ${queued} task(s) queued`
  );

  return { gaps: gaps.length, lessons: lessonsWritten, queued };
}
