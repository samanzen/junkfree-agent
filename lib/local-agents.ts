// Local-SEO specialist agents. These are the firepower that wins local
// service rankings (map pack + organic): GBP posts, review responses,
// citation/backlink opportunities, and search-intent fixing.

import { callClaude, extractJSON } from "./anthropic";
import { brandBlock, type Brand } from "./brands";
import { domainOf } from "./metrics";
import { referringDomainsList, isConfigured } from "./dataforseo";

function hostnameOf(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
  }
}

// Draft a Google Business Profile post. Active GBP profiles rank higher in the
// map pack, and posting weekly is one of the strongest local signals.
export async function draftGbpPost(brand: Brand, angle?: string) {
  const text = await callClaude({
    maxTokens: 500,
    user: `${brandBlock(brand)}

TASK: Write a Google Business Profile post${angle ? ` about: ${angle}` : " promoting the service"}.
Keep it 1500 characters max, local, specific, with one clear CTA. Avoid hype.
Return ONLY JSON: {"title":"short headline","body":"post text","cta":"Call now|Get a quote|Learn more"}`,
  });
  return extractJSON<{ title: string; body: string; cta: string }>(text);
}

// Draft a response to a customer review. Responding to ALL reviews (good and
// bad) is a confirmed local ranking factor and builds trust.
export async function draftReviewResponse(
  brand: Brand,
  review: { reviewer: string; rating: number; text: string }
) {
  return callClaude({
    maxTokens: 400,
    user: `${brandBlock(brand)}

TASK: Write a warm, professional response to this ${review.rating}-star review from ${review.reviewer}:
"""${review.text}"""
Rules: thank them by name, be genuine (not templated), keep it short, and for negative reviews stay calm, take it offline ("please call us at..."), never argue. Sign off as the ${brand.name} team.
Return only the response text.`,
  });
}

// Find local citation & backlink opportunities. Can't build links, but gives a
// prioritized outreach list — the highest-value free local-SEO work. Filters
// out anything that already links to us so only new opportunities surface.
export async function findCitations(brand: Brand) {
  const domain = domainOf(brand);
  const existingDomains = isConfigured() ? await referringDomainsList(domain).catch(() => []) : [];
  const knownSet = new Set(existingDomains.map((d) => d.replace(/^www\./, "").toLowerCase()));

  const text = await callClaude({
    search: true,
    maxTokens: 2000,
    user: `${brandBlock(brand)}

TASK: List the best citation and backlink opportunities for this local ${brand.services || "service"} business in ${brand.service_area}. Focus on high-authority local directories, industry associations, local business groups, chambers of commerce, review platforms, and niche directories that actually help local map-pack + organic rankings. Prioritise ones a competitor likely already has.
${knownSet.size ? `SITES THAT ALREADY LINK TO US — do NOT suggest these, only genuinely new opportunities:\n${[...knownSet].join(", ")}\n` : ""}
Return ONLY JSON array (max 15):
[{"name":"...","url":"...","category":"directory|association|local_news|review_platform|niche","priority":1-10,"rationale":"one line why it helps"}]`,
  });
  const parsed = extractJSON<
    { name: string; url: string; category: string; priority: number; rationale: string }[]
  >(text);
  if (!parsed) return parsed;
  // Hard filter, independent of whether the prompt was followed: never
  // surface a site we already have a live backlink from.
  return parsed.filter((c) => !knownSet.has(hostnameOf(c.url)));
}

// Fix search intent on a page. Core use: pages ranking for "free" terms that
// attract the wrong (freebie-seeking) audience — rewrite so paying customers
// self-qualify without losing the ranking/traffic.
export async function fixIntent(brand: Brand, url: string, rankingQueries: string[]) {
  return callClaude({
    maxTokens: 1200,
    user: `${brandBlock(brand)}

TASK: This page ranks for queries that may bring wrong-intent visitors: ${url}
Ranking queries: ${JSON.stringify(rankingQueries)}
${brand.intent_notes ? `Intent problem: ${brand.intent_notes}` : ""}
Rewrite the title tag, meta description, and opening paragraph so the RIGHT (paying) customers click and the wrong ones self-filter — WITHOUT dropping the ranking (keep the core keyword, add qualifying/pricing signals).
Return ONLY JSON: {"title":"<=60 chars","meta":"<=155 chars","opening":"2-3 sentence intro","why":"the angle in one line"}`,
  });
}
