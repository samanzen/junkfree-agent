// Resolve a typed competitor input (domain OR business name) into trackable
// website domains. Works for any industry — uses the brand's services/area
// for SERP context, never a hardcoded vertical.

import { serpTop, geoOf, type Geo } from "../dataforseo";
import {
  isTrackableCompetitor,
  normalizeCompetitorDomain,
} from "./filter";

const COMMON_TLDS = ["com", "ca", "co", "net", "io", "org", "co.uk", "com.au"] as const;

export type ResolveSuggestion = {
  domain: string;
  title?: string | null;
  reason: string;
};

export type ResolveResult =
  | { kind: "domain"; domain: string }
  | { kind: "suggestions"; query: string; suggestions: ResolveSuggestion[] }
  | { kind: "empty"; query: string; message: string };

/** True when the input already looks like a host (has a TLD, no spaces). */
export function looksLikeDomain(raw: string): boolean {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return false;
  const host = normalizeCompetitorDomain(s);
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host);
}

/** Collapse a business name into a domain-label slug: "Just Junk" → "justjunk". */
export function nameToSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function preferTldFromSite(siteUrl?: string | null): string | null {
  if (!siteUrl) return null;
  try {
    const host = new URL(siteUrl.includes("://") ? siteUrl : `https://${siteUrl}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
    const parts = host.split(".");
    if (parts.length >= 2) {
      const last2 = parts.slice(-2).join(".");
      if (["co.uk", "com.au", "co.nz", "com.br"].includes(last2)) return last2;
      return parts[parts.length - 1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Guess plausible domains from a bare name, preferring the brand's own TLD. */
export function nameToDomainCandidates(name: string, preferTld?: string | null): string[] {
  const slug = nameToSlug(name);
  if (slug.length < 2) return [];
  const ordered = preferTld
    ? [preferTld, ...COMMON_TLDS.filter((t) => t !== preferTld)]
    : [...COMMON_TLDS];
  return ordered.map((t) => `${slug}.${t}`);
}

function hostFromUrl(url: string): string | null {
  try {
    return normalizeCompetitorDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

export type ResolveBrandContext = {
  name?: string | null;
  services?: string | null;
  service_area?: string | null;
  site_url?: string | null;
  dataforseo_location_code?: number | null;
  dataforseo_language_code?: string | null;
};

/**
 * Turn "just junk" / "JustJunk" / "justjunk.ca" into a domain or a short
 * did-you-mean list. Industry context comes from the brand — not hardcoding.
 */
export async function resolveCompetitorInput(
  raw: string,
  brand: ResolveBrandContext
): Promise<ResolveResult> {
  const query = raw.trim();
  if (!query) {
    return { kind: "empty", query: "", message: "Enter a competitor website or business name." };
  }

  const own = brand.site_url || null;
  const preferTld = preferTldFromSite(brand.site_url);

  if (looksLikeDomain(query)) {
    const domain = normalizeCompetitorDomain(query);
    if (!isTrackableCompetitor(domain, own)) {
      return {
        kind: "empty",
        query,
        message:
          "That isn’t a competitor site. Add another business in your industry — not Facebook, Yelp, or a directory.",
      };
    }
    return { kind: "domain", domain };
  }

  const guesses = nameToDomainCandidates(query, preferTld);
  const geo: Geo = geoOf(brand);
  const services = (brand.services || "").trim();
  const area = (brand.service_area || "").trim();
  const serpQuery = [query, services, area, "official website"]
    .filter(Boolean)
    .join(" ")
    .slice(0, 120);

  const organic = await serpTop(serpQuery, geo).catch(() => []);
  const fromSerp: ResolveSuggestion[] = [];
  const seen = new Set<string>();

  for (const hit of organic) {
    const domain = hostFromUrl(hit.url);
    if (!domain || seen.has(domain)) continue;
    if (!isTrackableCompetitor(domain, own)) continue;
    seen.add(domain);
    const slug = nameToSlug(query);
    const reason =
      slug && domain.replace(/\./g, "").includes(slug)
        ? "Matches the name you typed"
        : "Found in search for that business";
    fromSerp.push({ domain, title: hit.title || null, reason });
    if (fromSerp.length >= 5) break;
  }

  // Prefer guesses that also appeared in SERP, then remaining SERP, then bare TLD guesses.
  const guessSet = new Set(guesses);
  const ranked: ResolveSuggestion[] = [];
  for (const g of guesses) {
    const hit = fromSerp.find((s) => s.domain === g);
    if (hit) ranked.push({ ...hit, reason: `Did you mean ${g}?` });
  }
  for (const s of fromSerp) {
    if (!ranked.some((r) => r.domain === s.domain)) ranked.push(s);
  }
  if (!ranked.length) {
    for (const g of guesses.slice(0, 4)) {
      ranked.push({ domain: g, reason: `Did you mean ${g}?` });
    }
  }

  if (!ranked.length) {
    return {
      kind: "empty",
      query,
      message:
        "Couldn’t find a website for that name. Try the full domain (e.g. competitor.com).",
    };
  }

  // One strong match: SERP domain equals top TLD guess, or only one result.
  const topGuess = guesses[0];
  const exact = ranked.find((r) => r.domain === topGuess && fromSerp.some((s) => s.domain === topGuess));
  if (exact && (fromSerp.length === 1 || guessSet.has(exact.domain))) {
    return { kind: "domain", domain: exact.domain };
  }
  if (ranked.length === 1 && fromSerp.length === 1) {
    return { kind: "domain", domain: ranked[0].domain };
  }

  return {
    kind: "suggestions",
    query,
    suggestions: ranked.slice(0, 5).map((s) => ({
      ...s,
      reason: s.reason.startsWith("Did you mean") ? s.reason : `Did you mean ${s.domain}?`,
    })),
  };
}
