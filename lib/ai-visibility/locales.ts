// AI VISIBILITY — locale derivation.
//
// Turns a brand's free-text service_area into structured places, because a
// report cannot group by city, region or country if those were never identified
// as such. "Beltline, Calgary, Alberta / Airdrie" becomes two locales: one with
// neighborhood=Beltline city=Calgary region=Alberta, one with city=Airdrie
// (region inherited from its sibling, since a list like that describes one
// area).
//
// Classification is by LOOKUP first (./geo-data.ts), position second. Position
// alone cannot tell "Calgary, Alberta" from "Calgary, Canada" — they have the
// same shape and different meanings — so a part is only treated as a region or
// a country when it is actually recognised as one. Anything unrecognised stays
// a place name, which is the safe failure: an unlabelled city is still usable
// in a prompt, whereas a city mislabelled as a region corrupts every rollup
// built on it.
//
// Nothing here calls a model or the network. It is a pure function of the
// brand's own fields plus the reference data, so it is fully unit-testable.

import type { Brand } from "../brands";
import { isLocalBusiness } from "../brands";
import type { Locale } from "./types";
import { languagesForCountry, lookupCountry, lookupRegion } from "./geo-data";

/** Separators that divide one service_area string into distinct areas. */
const AREA_SPLIT = /\s*(?:\/|;|\||\n|\r|\u2022|(?:\s+and\s+)|&)\s*/i;

/** Prefixes people write that describe a metro rather than a place name. */
const METRO_PREFIXES = [
  "greater", "metro", "metropolitan", "city of", "town of",
  "county of", "region of", "district of", "surrounding",
];

export type LocaleDerivationOptions = {
  /**
   * Also emit a locale per additional official language of the resolved
   * country, so a Montreal brand is measured in French as well as English.
   *
   * OFF by default and opt-in on purpose: a brand's language is a fact we hold
   * (brands.dataforseo_language_code), and inventing extra languages would
   * multiply cost and put questions in front of customers in languages they do
   * not serve. Turn it on for a brand that genuinely operates bilingually.
   */
  includeOfficialLanguages?: boolean;
  /** Hard ceiling on emitted locales, applied after ordering. */
  limit?: number;
};

/** Collapse whitespace without touching case — labels go into prompts verbatim. */
function tidy(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function stripMetroPrefix(raw: string): string {
  const lower = raw.toLowerCase();
  for (const p of METRO_PREFIXES) {
    if (lower.startsWith(p + " ")) return raw.slice(p.length + 1).trim();
  }
  return raw;
}

type ParsedArea = {
  label: string;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  neighborhood: string | null;
};

/**
 * Parse ONE area string ("Beltline, Calgary, Alberta, Canada") into its parts.
 *
 * Peels from the coarse end inwards: country if the last part is a known
 * country, then region if the (new) last part is a known subdivision, then the
 * last remaining part is the city and anything still left is the neighbourhood.
 * A single unrecognised part is a city — the overwhelmingly common case
 * ("Calgary") — not a region, because treating it as a region would leave every
 * city column empty.
 */
export function parseArea(raw: string): ParsedArea | null {
  const label = tidy(raw);
  if (!label) return null;

  const parts = label.split(",").map(tidy).filter(Boolean);
  if (!parts.length) return null;

  let country: string | null = null;
  let countryCode: string | null = null;
  let region: string | null = null;

  const remaining = [...parts];

  const maybeCountry = lookupCountry(remaining[remaining.length - 1]);
  if (maybeCountry && remaining.length > 1) {
    country = maybeCountry.name;
    countryCode = maybeCountry.code;
    remaining.pop();
  } else if (maybeCountry && remaining.length === 1) {
    // The whole area is a country — a national brand ("Canada"). No city.
    return {
      label,
      country: maybeCountry.name,
      countryCode: maybeCountry.code,
      region: null,
      city: null,
      neighborhood: null,
    };
  }

  if (remaining.length > 1) {
    const maybeRegion = lookupRegion(remaining[remaining.length - 1], countryCode);
    if (maybeRegion) {
      region = maybeRegion.region.name;
      countryCode = countryCode || maybeRegion.countryCode;
      country = country || lookupCountry(maybeRegion.countryCode)?.name || null;
      remaining.pop();
    }
  }

  const city = remaining.length ? stripMetroPrefix(remaining[remaining.length - 1]) : null;
  const neighborhood = remaining.length > 1 ? remaining.slice(0, -1).join(", ") : null;

  return { label, country, countryCode, region, city, neighborhood };
}

/** Split a service_area field into its individual areas. */
export function splitServiceArea(serviceArea: string | null | undefined): string[] {
  if (!serviceArea) return [];
  return serviceArea
    .split(AREA_SPLIT)
    .map(tidy)
    .filter((s) => s.length > 1);
}

/**
 * Derive the locales to measure for a brand.
 *
 * A non-local brand (SaaS, e-commerce, publisher) gets exactly one locale with
 * no city: its questions are national or global, and forcing a city into them
 * would measure something nobody asks. This mirrors isLocalBusiness() gating
 * used everywhere else in the pipeline.
 */
export function deriveLocales(brand: Brand, opts: LocaleDerivationOptions = {}): Locale[] {
  const baseLanguage = (brand.dataforseo_language_code || "en").toLowerCase();
  const areas = splitServiceArea(brand.service_area);
  const parsed = areas.map(parseArea).filter((p): p is ParsedArea => !!p);

  // A list like "Beltline, Calgary, Alberta / Airdrie" describes one area, so a
  // region or country stated once applies to the siblings that omitted it.
  const inheritedRegion = parsed.find((p) => p.region)?.region || null;
  const inheritedCountry = parsed.find((p) => p.country) || null;

  const out: Locale[] = [];
  const seen = new Set<string>();

  const push = (locale: Locale) => {
    const key = `${locale.label.toLowerCase()}|${locale.language}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(locale);
  };

  const languagesFor = (countryCode: string | null): string[] => {
    if (!opts.includeOfficialLanguages) return [baseLanguage];
    const official = languagesForCountry(countryCode).map((l) => l.toLowerCase());
    return [baseLanguage, ...official.filter((l) => l !== baseLanguage)];
  };

  if (!isLocalBusiness(brand) || !parsed.length) {
    // No place segment: the label is the country when we know one, otherwise
    // empty (prompt templates drop the place clause entirely).
    const country = inheritedCountry?.country || null;
    const countryCode = inheritedCountry?.countryCode || null;
    for (const language of languagesFor(countryCode)) {
      push({
        country,
        countryCode,
        region: null,
        city: null,
        neighborhood: null,
        label: country || "",
        language,
        dataforseoLocationCode: brand.dataforseo_location_code ?? null,
        source: "parsed",
      });
    }
    return opts.limit ? out.slice(0, opts.limit) : out;
  }

  // A neighbourhood-level area implies its city. "Beltline, Calgary" means the
  // brand serves Calgary, and being absent across the whole city matters far
  // more than being absent in one district of it — so the city gets its own
  // locale rather than only ever being measured through a neighbourhood.
  const withCityRollups: ParsedArea[] = [];
  for (const p of parsed) {
    if (p.neighborhood && p.city) {
      withCityRollups.push({
        label: p.city,
        country: p.country,
        countryCode: p.countryCode,
        region: p.region,
        city: p.city,
        neighborhood: null,
      });
    }
    withCityRollups.push(p);
  }

  for (const p of withCityRollups) {
    const countryCode = p.countryCode || inheritedCountry?.countryCode || null;
    const country = p.country || inheritedCountry?.country || null;
    for (const language of languagesFor(countryCode)) {
      push({
        country,
        countryCode,
        region: p.region || inheritedRegion,
        city: p.city,
        neighborhood: p.neighborhood,
        label: p.label,
        language,
        dataforseoLocationCode: brand.dataforseo_location_code ?? null,
        source: "parsed",
      });
    }
  }

  // Neighbourhood-level rows come last: they are the finest grain and the first
  // thing a cap should trim, since a brand invisible in its own city has a
  // bigger problem than one invisible in one neighbourhood of it.
  out.sort((a, b) => Number(!!a.neighborhood) - Number(!!b.neighborhood));

  return opts.limit ? out.slice(0, opts.limit) : out;
}

/** Human-readable one-liner for logs and report grouping. */
export function localeLabel(locale: Locale): string {
  const bits = [locale.neighborhood, locale.city, locale.region, locale.country].filter(Boolean);
  return bits.length ? bits.join(", ") : locale.label || "unspecified";
}
