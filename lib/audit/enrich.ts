// Optional off-page enrichment for the public free audit.
//
// Uses DataForSEO when configured. Never invents figures — if the provider is
// missing or a call fails, the report shows an honest empty/locked state and
// asks for signup rather than fabricating DA / keyword rows.

import {
  backlinksSummary,
  domainOverview,
  isConfigured,
  keywordDifficulty,
  rankedKeywords,
} from "@/lib/dataforseo";

/** How many keyword rows an anonymous visitor sees in full. */
export const FREE_KEYWORD_LIMIT = 5;

/** Cap how many ranked keywords we pull per anonymous audit (cost control). */
const RANKED_FETCH_LIMIT = 25;

export type AuditKeywordRow = {
  keyword: string;
  position: number;
  volume: number | null;
  difficulty: number | null;
};

export type AuditDomainIntel = {
  /** True when DataForSEO credentials are present (even if a call returned empty). */
  configured: boolean;
  locationLabel: string;
  organicTraffic: number | null;
  organicKeywords: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  keywordsPreview: AuditKeywordRow[];
  /** Exact remainder after the free preview — never inflated. */
  keywordsLockedCount: number;
};

function hostOf(finalUrl: string): string {
  try {
    return new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch {
    return finalUrl
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./, "");
  }
}

export function emptyDomainIntel(): AuditDomainIntel {
  return {
    configured: false,
    locationLabel: "Canada",
    organicTraffic: null,
    organicKeywords: null,
    backlinks: null,
    referringDomains: null,
    keywordsPreview: [],
    keywordsLockedCount: 0,
  };
}

/**
 * Best-effort domain / keyword / backlink snapshot for the free report.
 * Failures degrade to emptyIntel — the on-page audit still stands alone.
 */
export async function fetchDomainIntel(finalUrl: string): Promise<AuditDomainIntel> {
  if (!isConfigured()) return emptyDomainIntel();

  const domain = hostOf(finalUrl);
  if (!domain || !domain.includes(".")) return emptyDomainIntel();

  try {
    const [overview, backlinks, ranked] = await Promise.all([
      domainOverview(domain).catch(() => null),
      backlinksSummary(domain).catch(() => null),
      rankedKeywords(domain, {}, RANKED_FETCH_LIMIT).catch(
        () => [] as { keyword: string; position: number; volume: number | null }[]
      ),
    ]);

    // Prefer keywords that actually rank somewhere useful; keep order stable.
    const usable = (ranked || [])
      .filter((r) => r.keyword && r.position > 0)
      .slice(0, RANKED_FETCH_LIMIT);

    const previewSeed = usable.slice(0, FREE_KEYWORD_LIMIT);
    const difficultyRows = previewSeed.length
      ? await keywordDifficulty(previewSeed.map((k) => k.keyword)).catch(() => [])
      : [];
    const difficultyByKw = new Map(difficultyRows.map((d) => [d.keyword.toLowerCase(), d.difficulty]));

    const keywordsPreview: AuditKeywordRow[] = previewSeed.map((k) => ({
      keyword: k.keyword,
      position: k.position,
      volume: k.volume,
      difficulty: difficultyByKw.get(k.keyword.toLowerCase()) ?? null,
    }));

    return {
      configured: true,
      locationLabel: "Canada",
      organicTraffic: overview?.organic_traffic ?? null,
      organicKeywords: overview?.organic_keywords ?? null,
      backlinks: backlinks?.backlinks ?? null,
      referringDomains: backlinks?.referring_domains ?? null,
      keywordsPreview,
      keywordsLockedCount: Math.max(0, usable.length - keywordsPreview.length),
    };
  } catch {
    return { ...emptyDomainIntel(), configured: true };
  }
}
