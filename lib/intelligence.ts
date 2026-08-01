// INTELLIGENCE LAYER — the agents that "know things" before any content is made.
// Powered by real DataForSEO numbers + Claude reasoning. Each degrades
// gracefully: if DataForSEO isn't configured, they fall back to reasoning.

import { callClaude, extractJSON } from "./anthropic";
import { brandBlock, type Brand } from "./brands";
import {
  keywordIdeas,
  keywordVolumes,
  rankedKeywords,
  serpTop,
  isConfigured,
  geoOf,
  type KeywordData,
} from "./dataforseo";

// ---- 1. KEYWORD STRATEGIST -------------------------------------------------
// Builds the topical-authority target list: real long-tails with volume,
// prioritised by opportunity (decent volume, winnable competition, buyer intent).
export async function keywordStrategy(brand: Brand) {
  const seed = (brand.services || "").split(",")[0]?.trim() || "service";
  const area = (brand.service_area || "").split("/")[0]?.trim() || "";

  let ideas: KeywordData[] = [];
  if (isConfigured()) {
    const raw = await keywordIdeas(`${seed} ${area}`, geoOf(brand)).catch(() => []);
    // Keep keywords with real volume; drop zero-volume noise.
    ideas = raw.filter((k) => (k.volume ?? 0) > 0).slice(0, 40);
  }

  const text = await callClaude({
    maxTokens: 2000,
    user: `${brandBlock(brand)}

You are the Keyword Strategist. ${
      ideas.length
        ? `Here is REAL keyword data (search volume + competition 0-1) from Google:\n${JSON.stringify(ideas, null, 2)}`
        : `No live keyword tool data available — use your expertise for this local ${seed} business in ${area}.`
    }

Build a prioritised target list for TOPICAL AUTHORITY. For each pick, favour buyer/commercial intent and winnable competition. AVOID "free"-intent terms. Include long-tail opportunities.

Return ONLY JSON:
{"pillars":["3-5 core topics that anchor authority"],
 "targets":[{"keyword":"...","intent":"commercial|informational|local","volume":<number or null>,"why":"one line","page_type":"new_page|new_blog|improve_existing"}]}
Limit to the 12 best targets.`,
  });
  return extractJSON<{
    pillars: string[];
    targets: { keyword: string; intent: string; volume: number | null; why: string; page_type: string }[];
  }>(text);
}

// ---- 2. SERP ANALYST -------------------------------------------------------
// For a target keyword, dissects the live top-10 and outputs a concrete
// "blueprint to beat #1" the Content Engineer must exceed.
export async function serpBlueprint(brand: Brand, keyword: string) {
  let serp: { position: number; title: string; url: string; description: string }[] = [];
  if (isConfigured()) serp = await serpTop(keyword, geoOf(brand)).catch(() => []);

  const text = await callClaude({
    search: !serp.length, // if no SERP API data, let Claude search the web instead
    maxTokens: 1500,
    user: `${brandBlock(brand)}

You are the SERP Analyst. Target keyword: "${keyword}".
${
  serp.length
    ? `Here is the LIVE Google top-10 for this keyword:\n${JSON.stringify(serp, null, 2)}`
    : `Research who currently ranks for this keyword and what their pages look like.`
}

Produce a blueprint the writer must BEAT: the dominant content angle, what all top results cover (so we match), what they MISS (our edge), ideal depth, must-have sections/H2s, and the search intent.

Return ONLY JSON:
{"intent":"...","dominant_angle":"...","must_cover":["..."],"gaps_to_exploit":["..."],"target_depth_words":<number>,"recommended_h2s":["..."]}`,
  });
  return extractJSON<{
    intent: string;
    dominant_angle: string;
    must_cover: string[];
    gaps_to_exploit: string[];
    target_depth_words: number;
    recommended_h2s: string[];
  }>(text);
}

// ---- 3. COMPETITOR RECON ---------------------------------------------------
// Pulls a competitor's ranked keywords and finds gaps: what they rank for that
// we should target too.
export async function competitorGaps(brand: Brand) {
  const competitors = (brand.competitors || "")
    .split(",")
    .map((c) => c.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""))
    .filter(Boolean)
    .slice(0, 2);
  if (!competitors.length || !isConfigured()) return { competitors: [], gaps: [] };

  const all: { keyword: string; position: number; volume: number | null; competitor: string }[] = [];
  for (const domain of competitors) {
    const kws = await rankedKeywords(domain, geoOf(brand)).catch(() => []);
    kws
      .filter((k) => (k.volume ?? 0) > 0 && k.position <= 20)
      .slice(0, 40)
      .forEach((k) => all.push({ ...k, competitor: domain }));
  }
  if (!all.length) return { competitors, gaps: [] };

  const text = await callClaude({
    maxTokens: 1200,
    user: `${brandBlock(brand)}

You are Competitor Recon. These are keywords competitors rank for (with volume + their position):
${JSON.stringify(all.slice(0, 60), null, 2)}

Pick the 10 best GAP opportunities: high-value keywords we should target too (buyer intent, winnable, relevant). Avoid "free"-intent terms.
Return ONLY JSON: {"gaps":[{"keyword":"...","volume":<number>,"why":"one line","page_type":"new_page|new_blog|improve_existing"}]}`,
  });
  const parsed = extractJSON<{ gaps: { keyword: string; volume: number; why: string; page_type: string }[] }>(text);
  return { competitors, gaps: parsed?.gaps || [] };
}
