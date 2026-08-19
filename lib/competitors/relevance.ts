// Industry-aware competitor relevance.
//
// A competitor is another business in the SAME line of work fighting for the
// same customers — e.g. other movers for a moving company. Social networks,
// directories, and unrelated verticals (car dealers, banks, news sites) are
// not competitors even when they rank for overlapping keywords.
//
// Layering:
//   1. Host denylist (social/directories) — lib/competitors/filter.ts
//   2. Minimum keyword-overlap floor — drops weak SERP noise
//   3. Same-industry gate (this file) — Claude, given the brand's services

import { callClaude, extractJSON } from "../anthropic";
import type { Brand } from "../brands";
import { brandBlock } from "../brands";
import {
  filterTrackableCompetitors,
  normalizeCompetitorDomain,
} from "./filter";

/** Drop Labs hits below this shared-keyword count when overlap is known. */
export const MIN_KEYWORD_OVERLAP = 5;

export type CompetitorCandidate = {
  domain: string;
  keywordOverlap: number | null;
};

/** Pure overlap floor — exported for tests. */
export function applyOverlapFloor(
  candidates: CompetitorCandidate[],
  minOverlap = MIN_KEYWORD_OVERLAP
): CompetitorCandidate[] {
  const withFloor = candidates.filter(
    (c) => c.keywordOverlap == null || c.keywordOverlap >= minOverlap
  );
  if (withFloor.length) return withFloor;
  // All below floor: keep top overlaps so the industry gate still has input.
  return [...candidates]
    .sort((a, b) => (b.keywordOverlap ?? 0) - (a.keywordOverlap ?? 0))
    .slice(0, 8);
}

/**
 * Keep only domains that look like real rivals in this brand's industry.
 * Fail-open to denylist-only filtering if the model call fails — never invent
 * competitors, but also don't block discovery entirely when Claude is down.
 */
export async function keepSameIndustryCompetitors(
  brand: Brand,
  candidates: CompetitorCandidate[]
): Promise<CompetitorCandidate[]> {
  const own = brand.site_url || "";
  const list = applyOverlapFloor(filterTrackableCompetitors(candidates, own));

  if (!list.length) return [];

  const services = (brand.services || brand.name || "this business").trim();
  const text = await callClaude({
    maxTokens: 800,
    thinking: { type: "disabled" },
    label: `${brand.slug}/competitorIndustryGate`,
    user: `${brandBlock(brand)}

You decide which domains are TRUE COMPETITORS for this business.

Definition of a competitor:
- Same (or very closely related) industry / service line
- Competes for the same paying customers
- Examples for a moving company: other movers, junk removal, packing services — YES
- NOT competitors: Facebook, Yelp, Reddit, YouTube, news sites, banks, car dealerships,
  real-estate portals, job boards, generic blogs, government sites, or any business
  in a different industry that merely ranks for overlapping keywords

Brand services / vertical: ${services}

Candidate domains (with keyword-overlap counts from SEO Labs):
${JSON.stringify(
  list.map((c) => ({ domain: c.domain, keyword_overlap: c.keywordOverlap })),
  null,
  2
)}

Return ONLY JSON:
{"keep":[{"domain":"...","reason":"one short line why they are a rival"}]}

Rules:
- Keep at most 8
- Prefer local/national rivals in the same service line
- If NONE are real rivals, return {"keep":[]}
- Never keep social networks, directories, or unrelated industries`,
  }).catch(() => null);

  if (!text) {
    // Model unavailable — return denylist-filtered list (still better than raw Labs).
    return list.slice(0, 8);
  }

  const parsed = extractJSON<{ keep?: { domain?: string }[] }>(text);
  const keepSet = new Set(
    (parsed?.keep || [])
      .map((k) => normalizeCompetitorDomain(k.domain || ""))
      .filter(Boolean)
  );

  if (!keepSet.size) return [];

  return list.filter((c) => keepSet.has(normalizeCompetitorDomain(c.domain))).slice(0, 8);
}
