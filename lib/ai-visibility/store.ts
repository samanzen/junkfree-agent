// AI VISIBILITY — persistence.
//
// The only file that talks to the ai_visibility_* tables. Everything else in the
// module is pure, which keeps the interesting logic testable without a database.
//
// MIGRATION TOLERANCE. supabase/018_ai_visibility.sql is applied by hand in the
// Supabase SQL editor, exactly like every other migration in this project, so
// code must not assume it has been run. Each write is guarded: a
// "relation does not exist" error resolves to `{ migrated: false }` and the
// caller degrades — the run is skipped with a clear reason and the API reports
// available:false. This is the same convention lib/queue.ts uses for its
// optional observability columns and app/api/portal/technical uses for
// page_audits.

import { db } from "../supabase";
import type {
  AnswerAnalysis,
  AssistantAnswer,
  AssistantId,
  Locale,
  VisibilityPrompt,
} from "./types";
import { localeLabel } from "./locales";

/** PostgREST / Postgres codes that mean "this table or column isn't there yet". */
const MIGRATION_MISSING_CODES = new Set([
  "PGRST205", // PostgREST: table not found in schema cache
  "PGRST204", // PostgREST: column not found in schema cache
  "42P01",    // Postgres: undefined_table
  "42703",    // Postgres: undefined_column
]);

export function isMissingMigration(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && MIGRATION_MISSING_CODES.has(error.code);
}

export class MigrationMissingError extends Error {
  constructor() {
    super("ai_visibility tables are not present — apply supabase/018_ai_visibility.sql");
    this.name = "MigrationMissingError";
  }
}

type LocaleRow = {
  id: string;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  neighborhood: string | null;
  label: string;
  language: string;
  dataforseo_location_code: number | null;
  source: string;
  active: boolean;
};

function rowToLocale(row: LocaleRow): Locale {
  return {
    id: row.id,
    country: row.country,
    countryCode: row.country_code,
    region: row.region,
    city: row.city,
    neighborhood: row.neighborhood,
    label: row.label,
    language: row.language,
    dataforseoLocationCode: row.dataforseo_location_code,
    source: row.source === "explicit" ? "explicit" : "parsed",
  };
}

/**
 * Persist the derived locales and return the full active set for the brand.
 *
 * Read-then-insert-missing rather than upsert, for one specific reason: an
 * upsert on (brand_id, label, language) would overwrite rows an admin entered
 * by hand (source='explicit') with parsed values on every run. Explicit rows are
 * the ones a human took the trouble to add, so parsing must never touch them.
 */
export async function syncLocales(brandId: string, derived: Locale[]): Promise<Locale[]> {
  const { data: existing, error } = await db
    .from("ai_visibility_locales")
    .select("id, country, country_code, region, city, neighborhood, label, language, dataforseo_location_code, source, active")
    .eq("brand_id", brandId);

  if (error) {
    if (isMissingMigration(error)) throw new MigrationMissingError();
    throw new Error(`syncLocales: ${error.message}`);
  }

  const rows = (existing || []) as LocaleRow[];
  const key = (label: string, language: string) => `${label.toLowerCase()}|${language.toLowerCase()}`;
  const known = new Set(rows.map((r) => key(r.label, r.language)));

  const toInsert = derived.filter((l) => !known.has(key(l.label, l.language)));
  if (toInsert.length) {
    const { error: insertErr } = await db.from("ai_visibility_locales").insert(
      toInsert.map((l) => ({
        brand_id: brandId,
        country: l.country,
        country_code: l.countryCode,
        region: l.region,
        city: l.city,
        neighborhood: l.neighborhood,
        label: l.label,
        language: l.language,
        dataforseo_location_code: l.dataforseoLocationCode,
        source: l.source,
      }))
    );
    if (insertErr && !isMissingMigration(insertErr)) {
      throw new Error(`syncLocales insert: ${insertErr.message}`);
    }
  }

  const { data: after } = await db
    .from("ai_visibility_locales")
    .select("id, country, country_code, region, city, neighborhood, label, language, dataforseo_location_code, source, active")
    .eq("brand_id", brandId)
    .eq("active", true);

  return ((after || []) as LocaleRow[]).map(rowToLocale);
}

/**
 * Persist generated prompts and return them with their database ids.
 *
 * A prompt's text is NOT updated for an existing key. prompt_key is derived
 * from the template wording, so a reworded template produces a new key and a new
 * row — which is correct, because results either side of a rewording are not
 * comparable. Weight and active status ARE refreshed, since those are ranking
 * decisions rather than part of the question's identity.
 */
export async function syncPrompts(
  brandId: string,
  prompts: VisibilityPrompt[],
  localesById: Map<string, Locale>
): Promise<VisibilityPrompt[]> {
  const { data: existing, error } = await db
    .from("ai_visibility_prompts")
    .select("id, prompt_key, intent, template_id, service, locale_id, language, text, weight, active")
    .eq("brand_id", brandId);

  if (error) {
    if (isMissingMigration(error)) throw new MigrationMissingError();
    throw new Error(`syncPrompts: ${error.message}`);
  }

  type PromptRow = {
    id: string;
    prompt_key: string;
    intent: string;
    template_id: string;
    service: string | null;
    locale_id: string | null;
    language: string;
    text: string;
    weight: number;
    active: boolean;
  };
  const rows = (existing || []) as PromptRow[];
  const byKey = new Map(rows.map((r) => [r.prompt_key, r]));

  // Locale ids are resolved by (label, language) because generation works from
  // derived locales, which may not carry an id until syncLocales has run.
  const localeIdFor = (locale: Locale | null): string | null => {
    if (!locale) return null;
    if (locale.id) return locale.id;
    for (const [id, l] of localesById) {
      if (l.label.toLowerCase() === locale.label.toLowerCase() && l.language === locale.language) return id;
    }
    return null;
  };

  const toInsert = prompts.filter((p) => !byKey.has(p.promptKey));
  if (toInsert.length) {
    const { error: insertErr } = await db.from("ai_visibility_prompts").insert(
      toInsert.map((p) => ({
        brand_id: brandId,
        prompt_key: p.promptKey,
        intent: p.intent,
        template_id: p.templateId,
        service: p.service,
        locale_id: localeIdFor(p.locale),
        language: p.language,
        text: p.text,
        weight: p.weight,
      }))
    );
    if (insertErr && !isMissingMigration(insertErr)) {
      throw new Error(`syncPrompts insert: ${insertErr.message}`);
    }
  }

  // Refresh weight on rows whose ranking changed (e.g. the brand added a
  // service, so a previously-secondary service is now primary).
  for (const p of prompts) {
    const row = byKey.get(p.promptKey);
    if (row && (row.weight !== p.weight || !row.active)) {
      await db
        .from("ai_visibility_prompts")
        .update({ weight: p.weight, active: true })
        .eq("id", row.id);
    }
  }

  const { data: after } = await db
    .from("ai_visibility_prompts")
    .select("id, prompt_key, intent, template_id, service, locale_id, language, text, weight, active")
    .eq("brand_id", brandId)
    .eq("active", true)
    .order("weight", { ascending: false });

  const localeById = localesById;
  return ((after || []) as PromptRow[]).map((r) => ({
    id: r.id,
    promptKey: r.prompt_key,
    intent: r.intent as VisibilityPrompt["intent"],
    templateId: r.template_id,
    service: r.service,
    language: r.language,
    locale: r.locale_id ? localeById.get(r.locale_id) || null : null,
    text: r.text,
    weight: r.weight,
  }));
}

/** Start a run and return its id. */
export async function openRun(
  brandId: string,
  assistants: AssistantId[],
  promptsPlanned: number
): Promise<string> {
  const { data, error } = await db
    .from("ai_visibility_runs")
    .insert({
      brand_id: brandId,
      status: "running",
      assistants,
      prompts_planned: promptsPlanned,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingMigration(error)) throw new MigrationMissingError();
    throw new Error(`openRun: ${error.message}`);
  }
  return data!.id as string;
}

/** The run a slice-based sweep should keep appending to, if one is still open. */
export async function findOpenRun(brandId: string): Promise<{ id: string; promptsPlanned: number } | null> {
  const { data, error } = await db
    .from("ai_visibility_runs")
    .select("id, prompts_planned")
    .eq("brand_id", brandId)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingMigration(error)) throw new MigrationMissingError();
    return null;
  }
  const row = data?.[0];
  return row ? { id: row.id as string, promptsPlanned: (row.prompts_planned as number) || 0 } : null;
}

/** Prompt keys already checked in this run, so a resumed slice never repeats
 *  work that has already been paid for. */
export async function checkedKeysForRun(runId: string): Promise<Set<string>> {
  const { data } = await db
    .from("ai_visibility_checks")
    .select("prompt_key, assistant")
    .eq("run_id", runId);
  return new Set(((data || []) as { prompt_key: string; assistant: string }[]).map((r) => `${r.prompt_key}|${r.assistant}`));
}

export type RecordCheckInput = {
  brandId: string;
  runId: string;
  prompt: VisibilityPrompt;
  answer: AssistantAnswer;
  analysis: AnswerAnalysis | null;
};

/**
 * Record one check and its citations.
 *
 * The answer text is stored even when the analysis found nothing, because it is
 * the raw evidence: every derived column can be recomputed from it if the
 * extraction in ../analyze.ts improves.
 */
export async function recordCheck(input: RecordCheckInput): Promise<string | null> {
  const { brandId, runId, prompt, answer, analysis } = input;
  const locale = prompt.locale;

  const { data, error } = await db
    .from("ai_visibility_checks")
    .insert({
      brand_id: brandId,
      run_id: runId,
      prompt_id: prompt.id || null,
      prompt_key: prompt.promptKey,
      prompt_text: prompt.text,
      intent: prompt.intent,
      language: prompt.language,
      country: locale?.country ?? null,
      region: locale?.region ?? null,
      city: locale?.city ?? null,
      neighborhood: locale?.neighborhood ?? null,
      locale_label: locale ? localeLabel(locale) : null,
      assistant: answer.assistant,
      model: answer.model,
      mentioned: analysis?.mentioned ?? false,
      rank: analysis?.rank ?? null,
      brands_named: analysis?.brandsNamed ?? [],
      sentiment: analysis?.sentiment ?? null,
      share_of_voice: analysis?.shareOfVoice ?? null,
      answer_text: answer.text || null,
      latency_ms: answer.latencyMs,
      error: answer.error,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingMigration(error)) throw new MigrationMissingError();
    console.error(`[ai-visibility] recordCheck failed: ${error.message}`);
    return null;
  }

  const checkId = data!.id as string;

  if (analysis?.citations.length) {
    const { error: citeErr } = await db.from("ai_visibility_citations").insert(
      analysis.citations.map((c) => ({
        check_id: checkId,
        brand_id: brandId,
        url: c.url,
        domain: c.domain,
        title: c.title,
        position: c.position,
        is_own: c.isOwn,
      }))
    );
    if (citeErr && !isMissingMigration(citeErr)) {
      console.error(`[ai-visibility] citation insert failed: ${citeErr.message}`);
    }
  }

  return checkId;
}

/**
 * Close a run and freeze its mention rate.
 *
 * Checks that errored are excluded from the denominator: a provider outage must
 * not read as a drop in visibility. Checks where the assistant declined to name
 * anyone are also excluded, because nobody was mentioned in them — counting
 * those as losses would punish a brand for a question the assistant refused.
 */
export async function finalizeRun(runId: string): Promise<{ mentionRate: number | null; completed: number; failed: number }> {
  const { data, error } = await db
    .from("ai_visibility_checks")
    .select("mentioned, error, brands_named")
    .eq("run_id", runId);

  if (error) {
    if (isMissingMigration(error)) throw new MigrationMissingError();
    throw new Error(`finalizeRun: ${error.message}`);
  }

  type Row = { mentioned: boolean; error: string | null; brands_named: unknown };
  const rows = (data || []) as Row[];
  const failed = rows.filter((r) => !!r.error).length;
  const scorable = rows.filter((r) => !r.error && Array.isArray(r.brands_named) && r.brands_named.length > 0);
  const mentioned = scorable.filter((r) => r.mentioned).length;
  const mentionRate = scorable.length
    ? Math.round((mentioned / scorable.length) * 10000) / 100
    : null;

  await db
    .from("ai_visibility_runs")
    .update({
      status: "done",
      checks_completed: rows.length - failed,
      checks_failed: failed,
      mention_rate: mentionRate,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  return { mentionRate, completed: rows.length - failed, failed };
}

/** Mark a run as errored, so a half-finished sweep is not read as a real result. */
export async function failRun(runId: string, message: string): Promise<void> {
  await db
    .from("ai_visibility_runs")
    .update({ status: "error", error: message.slice(0, 500), finished_at: new Date().toISOString() })
    .eq("id", runId);
}

/** Locales keyed by id, for resolving prompt rows back to their place. */
export async function localeMap(brandId: string): Promise<Map<string, Locale>> {
  const { data, error } = await db
    .from("ai_visibility_locales")
    .select("id, country, country_code, region, city, neighborhood, label, language, dataforseo_location_code, source, active")
    .eq("brand_id", brandId);

  if (error) {
    if (isMissingMigration(error)) throw new MigrationMissingError();
    return new Map();
  }

  const m = new Map<string, Locale>();
  for (const row of (data || []) as LocaleRow[]) m.set(row.id, rowToLocale(row));
  return m;
}
