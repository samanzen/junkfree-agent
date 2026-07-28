// LEARNING LAYER — what separates elite SEO from fire-and-forget.
// The Performance Analyst reads GSC over time, figures out what worked and what
// decayed, and writes "lessons" that feed back into future strategy. The system
// gets smarter every week.

import { callClaude, extractJSON } from "./anthropic";
import { brandBlock, type Brand } from "./brands";
import { db } from "./supabase";
import { strikingDistance, lowCtrPages } from "./gsc";

// Analyse recent performance and store lessons + a weekly report.
export async function analysePerformance(brand: Brand) {
  if (!brand.gsc_property) return null;

  const [striking, lowCtr] = await Promise.all([
    strikingDistance(brand.gsc_property).catch(() => []),
    lowCtrPages(brand.gsc_property).catch(() => []),
  ]);

  // Pull the last stored snapshot to compare against (detect movement + decay).
  const { data: prev } = await db
    .from("reports")
    .select("metrics, created_at")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const previous = prev?.[0]?.metrics || null;

  // Pull prior lessons so the analyst builds on them, not repeats them.
  const { data: pastLessons } = await db
    .from("lessons")
    .select("lesson")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(10);

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

  // Store the snapshot + report.
  await db.from("reports").insert({
    brand_id: brand.id,
    period_end: new Date().toISOString().slice(0, 10),
    summary: parsed.summary,
    metrics: { striking: striking.slice(0, 20), lowCtr: lowCtr.slice(0, 15), next_focus: parsed.next_focus },
  });

  // Store lessons so future runs learn from them.
  for (const lesson of parsed.lessons || []) {
    await db.from("lessons").insert({ brand_id: brand.id, lesson });
  }

  return parsed;
}

// Give the Strategist the accumulated lessons so it plans smarter each run.
export async function activeLessons(brand: Brand): Promise<string[]> {
  const { data } = await db
    .from("lessons")
    .select("lesson")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(15);
  return (data || []).map((l: { lesson: string }) => l.lesson);
}
