// AI VISIBILITY — the sweep.
//
// One run asks every selected prompt of every configured assistant. That is
// prompts x assistants calls, each one a web-search-grounded model call, so this
// is the most expensive thing the platform does per unit of output. Three
// mechanisms keep it safe:
//
//  1. CAPS. Prompts per run, checks per step and locales per brand are all
//     bounded by environment variables, in the same spirit as MAX_TASKS_PER_RUN.
//     The defaults are deliberately modest.
//
//  2. SLICING. A run is processed across as many queue jobs as it needs, each
//     one stopping at a time budget well inside the platform's 60s function
//     limit and enqueueing its own continuation. No single invocation can be
//     killed mid-sweep and lose the work already paid for, because every check
//     is written as it completes.
//
//  3. CADENCE. Its own weekly cron, separate from the daily content pipeline.
//     These answers are non-deterministic — ask the same model twice and the
//     list changes — so the signal is a rate over many prompts and repeated
//     sweeps, not a daily reading.

import type { Brand } from "../brands";
import { db } from "../supabase";
import { enqueue } from "../queue";
import { analyseVisibilityRun } from "./analyst";
import { analyzeAnswer, identityOf } from "./analyze";
import { deriveLocales } from "./locales";
import { generatePrompts } from "./prompts";
import { isNoResultsAnswer, selectedProviders } from "./providers";
import {
  MigrationMissingError,
  checkedKeysForRun,
  failRun,
  finalizeRun,
  findOpenRun,
  localeMap,
  openRun,
  recordCheck,
  syncLocales,
  syncPrompts,
} from "./store";
import type { AssistantId, BrandIdentity, VisibilityPrompt } from "./types";

function intFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/** How many distinct questions one sweep covers. */
const PROMPTS_PER_RUN = () => intFromEnv("AI_VISIBILITY_PROMPTS_PER_RUN", 12);
/** How many (prompt x assistant) checks one queue job performs. */
const CHECKS_PER_STEP = () => intFromEnv("AI_VISIBILITY_CHECKS_PER_STEP", 6);
/** How many places a brand is measured in. */
const MAX_LOCALES = () => intFromEnv("AI_VISIBILITY_MAX_LOCALES", 6);
/**
 * Wall-clock budget for one job. Well under the 60s platform limit, because a
 * grounded search call can take ten seconds or more and the job still has to
 * write its results and enqueue its continuation afterwards.
 */
const STEP_BUDGET_MS = () => intFromEnv("AI_VISIBILITY_STEP_BUDGET_MS", 40_000);

/** Opt-in multilingual expansion — see deriveLocales for why it is off by default. */
const multilingual = () => process.env.AI_VISIBILITY_MULTILINGUAL === "1";

export type SweepResult = {
  skipped?: string;
  runId?: string;
  checks?: number;
  remaining?: number;
  done?: boolean;
  mentionRate?: number | null;
};

/** Tracked competitors, so a rival in an answer is recognised rather than
 *  discovered as an unknown string. Best-effort: the table is optional. */
async function trackedCompetitors(brandId: string): Promise<{ name: string; domain: string | null }[]> {
  const { data, error } = await db
    .from("competitors")
    .select("domain, name")
    .eq("brand_id", brandId)
    .eq("active", true)
    .limit(25);
  if (error) return [];
  return ((data || []) as { domain: string | null; name: string | null }[])
    .map((c) => ({ name: c.name || c.domain || "", domain: c.domain }))
    .filter((c) => !!c.name);
}

/**
 * Plan a sweep: resolve locales, generate prompts, persist both.
 *
 * Separated from execution so the plan can be inspected (and tested) without
 * spending anything on model calls.
 */
export async function planSweep(brand: Brand): Promise<{ prompts: VisibilityPrompt[]; assistants: AssistantId[] }> {
  const derived = deriveLocales(brand, {
    includeOfficialLanguages: multilingual(),
    limit: MAX_LOCALES(),
  });
  const locales = await syncLocales(brand.id, derived);
  const byId = await localeMap(brand.id);

  const generated = generatePrompts(brand, locales, { limit: PROMPTS_PER_RUN() });
  const prompts = await syncPrompts(brand.id, generated, byId);

  // syncPrompts returns every active prompt for the brand, including ones from
  // earlier template versions. Restrict the sweep to the set generated now, in
  // the order generation ranked them, so a cap always trims the same tail.
  const wanted = new Map(generated.map((p) => [p.promptKey, p]));
  const ordered = prompts
    .filter((p) => wanted.has(p.promptKey))
    .sort((a, b) => b.weight - a.weight || a.promptKey.localeCompare(b.promptKey));

  return {
    prompts: ordered.slice(0, PROMPTS_PER_RUN()),
    assistants: selectedProviders().map((p) => p.id),
  };
}

/**
 * Process one slice of a sweep.
 *
 * Opens a run if none is in progress, performs as many checks as the budget
 * allows, and either enqueues its continuation or finalises the run. Safe to
 * call repeatedly: work already recorded for the open run is never repeated.
 */
export async function stepAiVisibility(brand: Brand): Promise<SweepResult> {
  const providers = selectedProviders();
  if (!providers.length) {
    return { skipped: "no assistant credentials configured (set ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, PERPLEXITY_API_KEY or DataForSEO)" };
  }

  let plan: { prompts: VisibilityPrompt[]; assistants: AssistantId[] };
  try {
    plan = await planSweep(brand);
  } catch (e) {
    if (e instanceof MigrationMissingError) {
      console.warn(`[ai-visibility] ${brand.slug}: ${e.message}`);
      return { skipped: "not_migrated" };
    }
    throw e;
  }

  if (!plan.prompts.length) {
    return { skipped: "no prompts could be generated (brand has no services listed)" };
  }

  const open = await findOpenRun(brand.id);
  const runId = open?.id || (await openRun(brand.id, plan.assistants, plan.prompts.length));
  const alreadyChecked = await checkedKeysForRun(runId);

  const identity: BrandIdentity = identityOf(brand, {
    competitors: await trackedCompetitors(brand.id),
  });

  // The full work list for this run, prompt-major so the highest-weighted
  // questions are covered across every assistant before the tail is started.
  const work: { prompt: VisibilityPrompt; assistantIds: AssistantId[] }[] = [];
  for (const prompt of plan.prompts) {
    const pending = providers
      .map((p) => p.id)
      .filter((id) => !alreadyChecked.has(`${prompt.promptKey}|${id}`));
    if (pending.length) work.push({ prompt, assistantIds: pending });
  }

  const totalPending = work.reduce((n, w) => n + w.assistantIds.length, 0);
  if (!totalPending) return completeRun(brand, runId, 0);

  const startedAt = Date.now();
  const budget = STEP_BUDGET_MS();
  const maxChecks = CHECKS_PER_STEP();
  let performed = 0;

  try {
    for (const item of work) {
      if (performed >= maxChecks || Date.now() - startedAt > budget) break;

      // One prompt across the assistants in parallel: they are separate vendors
      // with separate rate limits, so there is nothing to serialise, and it
      // keeps a prompt's readings close together in time — which matters,
      // because these answers change through the day.
      const askable = item.assistantIds.slice(0, Math.max(1, maxChecks - performed));
      const answers = await Promise.all(
        askable.map(async (id) => {
          const provider = providers.find((p) => p.id === id)!;
          return provider.ask(item.prompt.text, item.prompt.locale);
        })
      );

      for (const answer of answers) {
        // An assistant that declined to name anyone is recorded with its text
        // but WITHOUT an analysis, so finalizeRun leaves it out of the mention
        // rate. Scoring it as a miss would penalise the brand for a question
        // the assistant refused to answer.
        const declined = !answer.error && isNoResultsAnswer(answer.text);
        const analysis = answer.error || declined
          ? null
          : analyzeAnswer(answer.text, answer.citations, identity);

        await recordCheck({ brandId: brand.id, runId, prompt: item.prompt, answer, analysis });
        performed++;
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await failRun(runId, message);
    throw e;
  }

  const remaining = totalPending - performed;

  if (remaining > 0) {
    // Continue in a fresh job rather than pushing this invocation towards the
    // platform's function limit. Every check performed above is already stored,
    // so the continuation resumes rather than restarts.
    await enqueue(brand.id, "ai_visibility", { runId, continuation: true });
    console.log(`[ai-visibility] ${brand.slug}: ${performed} checks this step, ${remaining} remaining — continuation queued`);
    return { runId, checks: performed, remaining, done: false };
  }

  return completeRun(brand, runId, performed);
}

/**
 * Finalise a run, publish its rate, and hand it to the analyst.
 *
 * The analyst call is what makes this a loop rather than a dashboard: it writes
 * lessons the Strategist reads on the next planning run and queues content for
 * the questions we lost. Deliberately best-effort — a failure there must not
 * lose a sweep that has already been paid for.
 */
async function completeRun(brand: Brand, runId: string, performed: number): Promise<SweepResult> {
  const { mentionRate, completed, failed } = await finalizeRun(runId);
  await writeSnapshotVisibility(brand.id, mentionRate);
  console.log(
    `[ai-visibility] ${brand.slug}: run ${runId} complete — ${completed} checks, ${failed} failed, mention rate ${mentionRate ?? "n/a"}%`
  );

  try {
    await analyseVisibilityRun(brand, runId);
  } catch (e) {
    console.error(`[ai-visibility] ${brand.slug}: analyst failed — ${e instanceof Error ? e.message : String(e)}`);
  }

  return { runId, checks: performed, remaining: 0, done: true, mentionRate };
}

/**
 * Publish the run's mention rate onto the newest metric snapshot.
 *
 * metric_snapshots.ai_visibility is what the dashboard's KPI card and the
 * portal read. It used to hold 100 or 0 from a single yes/no check; it now holds
 * a genuine percentage — the share of measured questions in which the brand
 * appeared — which is the number the card's `%` suffix always implied.
 *
 * Best-effort and non-fatal: a brand with no snapshot yet simply has nothing to
 * annotate, and the next snapshot will pick the rate up through lib/metrics.ts.
 */
async function writeSnapshotVisibility(brandId: string, mentionRate: number | null): Promise<void> {
  if (mentionRate == null) return;
  const { data } = await db
    .from("metric_snapshots")
    .select("id")
    .eq("brand_id", brandId)
    .order("captured_at", { ascending: false })
    .limit(1);
  const id = data?.[0]?.id;
  if (!id) return;
  await db.from("metric_snapshots").update({ ai_visibility: Math.round(mentionRate) }).eq("id", id);
}

/**
 * The most recent finalised mention rate for a brand, 0–100.
 *
 * Read by lib/metrics.ts when taking a snapshot, so the KPI reflects the latest
 * completed sweep instead of a fresh single-question probe. Returns null when
 * the feature is not migrated or has never run — the same value every snapshot
 * carried before this module existed, so nothing downstream has to change.
 */
export async function latestMentionRate(brandId: string): Promise<number | null> {
  const { data, error } = await db
    .from("ai_visibility_runs")
    .select("mention_rate")
    .eq("brand_id", brandId)
    .eq("status", "done")
    .not("mention_rate", "is", null)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) return null;
  const rate = data?.[0]?.mention_rate;
  return rate == null ? null : Math.round(Number(rate));
}
