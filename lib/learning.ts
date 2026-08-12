// LEARNING LAYER — what separates elite SEO from fire-and-forget.
// The Performance Analyst reads GSC over time, figures out what worked and what
// decayed, and writes "lessons" that feed back into future strategy. Outcome
// attribution (lib/outcomes.ts) is folded in as a soft signal so the planner
// prefers moves that previously improved results — and avoids ones that did not.

import { callClaude, extractJSON } from "./anthropic";
import { brandBlock, type Brand } from "./brands";
import { db } from "./supabase";
import { strikingDistance, lowCtrPages } from "./gsc";
import {
  attributeAction,
  type ActionForAttribution,
  type DailyMetric,
  type OutcomeStatus,
} from "./outcomes";

// Analyse recent performance and store lessons + a weekly report.
export async function analysePerformance(brand: Brand) {
  if (!brand.gsc_property) return null;

  const [striking, lowCtr] = await Promise.all([
    strikingDistance(brand.gsc_property).catch(() => []),
    lowCtrPages(brand.gsc_property).catch(() => []),
  ]);

  const { data: prev } = await db
    .from("reports")
    .select("metrics, created_at")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const previous = prev?.[0]?.metrics || null;

  const { data: pastLessons } = await db
    .from("lessons")
    .select("lesson")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const outcomeLines = await recentOutcomeLessons(brand.id);

  const text = await callClaude({
    maxTokens: 1800,
    user: `${brandBlock(brand)}

You are the Performance Analyst. Compare current Search Console signals to the previous snapshot, identify what improved, what decayed, and what to do next.

CURRENT — striking distance (pos 5-20):
${JSON.stringify(striking.slice(0, 15), null, 2)}
CURRENT — low-CTR pages:
${JSON.stringify(lowCtr.slice(0, 10), null, 2)}
PREVIOUS SNAPSHOT:
${previous ? JSON.stringify(previous, null, 2) : "none (first run — establish a baseline)"}
OUTCOME ATTRIBUTION (executed work → later GSC movement — correlative, not causal):
${outcomeLines.length ? outcomeLines.map((l) => "- " + l).join("\n") : "none yet"}
PRIOR LESSONS (don't repeat):
${(pastLessons || []).map((l) => "- " + l.lesson).join("\n") || "none yet"}

Return ONLY JSON:
{"summary":"2-3 sentence human report of the week",
 "wins":["pages/keywords that improved"],
 "decay":["pages losing ground that need a refresh"],
 "lessons":["1-4 concrete lessons to guide future strategy"],
 "next_focus":["2-3 priorities for the coming week"]}`,
  });

  const parsed = extractJSON<{
    summary: string;
    wins: string[];
    decay: string[];
    lessons: string[];
    next_focus: string[];
  }>(text);
  if (!parsed) return null;

  await db.from("reports").insert({
    brand_id: brand.id,
    period_end: new Date().toISOString().slice(0, 10),
    summary: parsed.summary,
    metrics: { striking: striking.slice(0, 20), lowCtr: lowCtr.slice(0, 15), next_focus: parsed.next_focus },
  });

  for (const lesson of parsed.lessons || []) {
    await db.from("lessons").insert({ brand_id: brand.id, lesson });
  }

  return parsed;
}

export async function activeLessons(brand: Brand): Promise<string[]> {
  const [{ data }, outcomeLines] = await Promise.all([
    db
      .from("lessons")
      .select("lesson")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })
      .limit(12),
    recentOutcomeLessons(brand.id),
  ]);
  const stored = (data || []).map((l: { lesson: string }) => l.lesson);
  return [...outcomeLines, ...stored].slice(0, 18);
}

/** Soft lessons derived from seo_action_events × keyword_positions. */
export async function recentOutcomeLessons(brandId: string): Promise<string[]> {
  const { data: events, error } = await db
    .from("seo_action_events")
    .select("id, occurred_at, event_type, event_label, event_detail, page_url, keyword_id")
    .eq("brand_id", brandId)
    .order("occurred_at", { ascending: false })
    .limit(12);

  if (error || !events?.length) return [];

  const keywordIds = [
    ...new Set(events.map((e) => e.keyword_id).filter(Boolean)),
  ] as string[];
  const kwById = new Map<string, string>();
  if (keywordIds.length) {
    const { data: kws } = await db.from("tracked_keywords").select("id, keyword").in("id", keywordIds);
    for (const k of kws || []) kwById.set(k.id, k.keyword);
  }

  const actions: ActionForAttribution[] = events.map((e) => ({
    id: e.id,
    occurredAt: e.occurred_at,
    eventType: e.event_type,
    eventLabel: e.event_label,
    eventDetail: e.event_detail,
    pageUrl: e.page_url,
    keyword: (e.keyword_id && kwById.get(e.keyword_id)) || null,
  }));

  const { data: positions } = await db
    .from("keyword_positions")
    .select("date, keyword, page, position, clicks, impressions, ctr")
    .eq("brand_id", brandId)
    .order("date", { ascending: true })
    .limit(5000);

  const byKey = new Map<string, DailyMetric[]>();
  for (const p of positions || []) {
    const key = `${p.keyword || ""}||${p.page || ""}`;
    const list = byKey.get(key) || [];
    list.push({
      date: p.date,
      position: p.position,
      clicks: p.clicks || 0,
      impressions: p.impressions || 0,
      ctr: p.ctr || 0,
    });
    byKey.set(key, list);
  }

  const lines: string[] = [];
  const interesting: OutcomeStatus[] = ["improved", "declined", "unchanged"];
  for (const action of actions) {
    const key = `${action.keyword || ""}||${action.pageUrl || ""}`;
    const series =
      byKey.get(key) ||
      [...byKey.entries()]
        .filter(([k]) => (action.keyword ? k.startsWith(`${action.keyword}||`) : false))
        .flatMap(([, v]) => v);
    const attributed = attributeAction(action, series, new Date());
    if (!interesting.includes(attributed.status)) continue;
    lines.push(
      `${attributed.status.toUpperCase()}: "${action.eventLabel}"` +
        (action.keyword ? ` (${action.keyword})` : "") +
        ` — ${attributed.explanation}`
    );
  }
  return lines.slice(0, 8);
}
