import { test, expect } from "vitest";
import { deriveLocales, localeLabel, parseArea, splitServiceArea } from "./locales";
import { lookupCountry, lookupRegion, languagesForCountry } from "./geo-data";
import type { Brand } from "../brands";

function brand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: "b1",
    slug: "acme",
    name: "Acme Junk Removal",
    site_url: "https://acme.ca",
    gsc_property: null,
    gbp_location_id: null,
    service_area: "Calgary",
    services: "junk removal",
    edge: null,
    voice: null,
    competitors: null,
    intent_notes: null,
    auto_publish_meta: false,
    active: true,
    owner_email: null,
    business_model: "local_service",
    dataforseo_location_code: 2124,
    dataforseo_language_code: "en",
    ...overrides,
  };
}

// ── Reference data ──────────────────────────────────────────────────────────
test("countries are found by name, code and alias", () => {
  expect(lookupCountry("Canada")?.code).toBe("CA");
  expect(lookupCountry("ca")?.code).toBe("CA");
  expect(lookupCountry("USA")?.code).toBe("US");
  expect(lookupCountry("U.S.A.")?.code).toBe("US");
  expect(lookupCountry("türkiye")?.code).toBe("TR");
  expect(lookupCountry("Nowhereland")).toBeNull();
});

test("regions are found by name and, when the country is known, by code", () => {
  expect(lookupRegion("Alberta")?.region.code).toBe("AB");
  expect(lookupRegion("AB", "CA")?.region.name).toBe("Alberta");
  expect(lookupRegion("Québec")?.region.code).toBe("QC");
});

test("an ambiguous two-letter code is not guessed without a country", () => {
  // "WA" is Washington and Western Australia; "SA" is South Australia. Guessing
  // between them would silently mislabel every rollup built on the region.
  expect(lookupRegion("WA")).toBeNull();
  expect(lookupRegion("WA", "US")?.region.name).toBe("Washington");
  expect(lookupRegion("WA", "AU")?.region.name).toBe("Western Australia");
});

test("official languages are listed most widely used first", () => {
  expect(languagesForCountry("CA")).toEqual(["en", "fr"]);
  expect(languagesForCountry("CH")[0]).toBe("de");
  expect(languagesForCountry(null)).toEqual([]);
});

// ── Splitting ───────────────────────────────────────────────────────────────
test("service areas split on every separator people actually use", () => {
  expect(splitServiceArea("Calgary / Airdrie / Okotoks")).toEqual(["Calgary", "Airdrie", "Okotoks"]);
  expect(splitServiceArea("Calgary; Airdrie")).toEqual(["Calgary", "Airdrie"]);
  expect(splitServiceArea("Calgary and Airdrie")).toEqual(["Calgary", "Airdrie"]);
  expect(splitServiceArea("Calgary | Airdrie")).toEqual(["Calgary", "Airdrie"]);
  expect(splitServiceArea(null)).toEqual([]);
});

// ── Parsing ─────────────────────────────────────────────────────────────────
test("a bare place is a city, not a region", () => {
  // Treating it as a region would leave the city column empty for almost every
  // brand, since "Calgary" is how service areas are actually written.
  const p = parseArea("Calgary")!;
  expect(p.city).toBe("Calgary");
  expect(p.region).toBeNull();
  expect(p.country).toBeNull();
});

test("city and region are distinguished from city and country", () => {
  const withRegion = parseArea("Calgary, Alberta")!;
  expect(withRegion.city).toBe("Calgary");
  expect(withRegion.region).toBe("Alberta");
  expect(withRegion.country).toBe("Canada"); // inferred from the subdivision
  expect(withRegion.countryCode).toBe("CA");

  const withCountry = parseArea("Calgary, Canada")!;
  expect(withCountry.city).toBe("Calgary");
  expect(withCountry.region).toBeNull();
  expect(withCountry.country).toBe("Canada");
});

test("a neighbourhood is kept separate from its city", () => {
  const p = parseArea("Beltline, Calgary, Alberta, Canada")!;
  expect(p.neighborhood).toBe("Beltline");
  expect(p.city).toBe("Calgary");
  expect(p.region).toBe("Alberta");
  expect(p.country).toBe("Canada");
});

test("a country on its own has no city", () => {
  const p = parseArea("Canada")!;
  expect(p.country).toBe("Canada");
  expect(p.city).toBeNull();
});

test("metro wording is stripped from the city but kept in the label", () => {
  const p = parseArea("Greater Toronto Area, Ontario")!;
  expect(p.city).toBe("Toronto Area");
  expect(p.label).toBe("Greater Toronto Area, Ontario");
});

test("an unrecognised place stays a place name", () => {
  // The safe failure: usable in a prompt, and never mislabelled as a region.
  const p = parseArea("Zzyzx")!;
  expect(p.city).toBe("Zzyzx");
  expect(p.region).toBeNull();
  expect(p.country).toBeNull();
});

// ── Derivation ──────────────────────────────────────────────────────────────
test("each area in a service area becomes its own locale", () => {
  const locales = deriveLocales(brand({ service_area: "Calgary / Airdrie / Okotoks" }));
  expect(locales.map((l) => l.city)).toEqual(["Calgary", "Airdrie", "Okotoks"]);
  expect(locales.every((l) => l.language === "en")).toBe(true);
});

test("a region stated once is inherited by its siblings", () => {
  // "Calgary, Alberta / Airdrie" describes one area, so Airdrie is in Alberta.
  const locales = deriveLocales(brand({ service_area: "Calgary, Alberta / Airdrie" }));
  expect(locales.find((l) => l.city === "Airdrie")?.region).toBe("Alberta");
  expect(locales.find((l) => l.city === "Airdrie")?.country).toBe("Canada");
});

test("neighbourhood locales sort last so a cap trims them first", () => {
  const locales = deriveLocales(brand({ service_area: "Beltline, Calgary / Calgary" }));
  expect(locales[locales.length - 1].neighborhood).toBe("Beltline");
});

test("a neighbourhood area also measures its city", () => {
  // "Beltline, Calgary" means the brand serves Calgary. Measuring only the
  // neighbourhood would miss the bigger problem: being absent city-wide.
  const locales = deriveLocales(brand({ service_area: "Beltline, Calgary, Alberta" }));
  const city = locales.find((l) => !l.neighborhood)!;
  const hood = locales.find((l) => l.neighborhood === "Beltline")!;

  expect(city.city).toBe("Calgary");
  expect(city.label).toBe("Calgary");
  expect(city.region).toBe("Alberta");
  expect(hood.city).toBe("Calgary");
  // City first, so a cap keeps the more important measurement.
  expect(locales.indexOf(city)).toBeLessThan(locales.indexOf(hood));
});

test("a city listed both alone and via a neighbourhood is not duplicated", () => {
  const locales = deriveLocales(brand({ service_area: "Beltline, Calgary / Calgary" }));
  expect(locales.filter((l) => l.city === "Calgary" && !l.neighborhood)).toHaveLength(1);
});

test("two neighbourhoods of one city roll up to a single city locale", () => {
  const locales = deriveLocales(brand({ service_area: "Beltline, Calgary / Kensington, Calgary" }));
  expect(locales.filter((l) => !l.neighborhood)).toHaveLength(1);
  expect(locales.filter((l) => l.neighborhood)).toHaveLength(2);
});

test("a non-local brand gets one placeless locale", () => {
  const locales = deriveLocales(brand({ business_model: "saas", service_area: "Calgary / Airdrie" }));
  expect(locales).toHaveLength(1);
  expect(locales[0].city).toBeNull();
});

test("the brand's configured language is the only one used by default", () => {
  const locales = deriveLocales(brand({ service_area: "Montreal, Quebec" }));
  expect(locales.map((l) => l.language)).toEqual(["en"]);
});

test("multilingual expansion is opt-in and adds the country's other languages", () => {
  const locales = deriveLocales(brand({ service_area: "Montreal, Quebec" }), {
    includeOfficialLanguages: true,
  });
  expect(locales.map((l) => l.language).sort()).toEqual(["en", "fr"]);
});

test("the brand's own language is never duplicated by expansion", () => {
  const locales = deriveLocales(
    brand({ service_area: "Montreal, Quebec", dataforseo_language_code: "fr" }),
    { includeOfficialLanguages: true }
  );
  expect(locales.filter((l) => l.language === "fr")).toHaveLength(1);
});

test("the limit is applied after ordering", () => {
  const locales = deriveLocales(brand({ service_area: "Calgary / Airdrie / Okotoks / Cochrane" }), {
    limit: 2,
  });
  expect(locales).toHaveLength(2);
});

test("a brand with no service area still yields a measurable locale", () => {
  const locales = deriveLocales(brand({ service_area: null }));
  expect(locales).toHaveLength(1);
});

test("localeLabel reads coarse-to-fine and never returns empty", () => {
  expect(
    localeLabel({
      country: "Canada", countryCode: "CA", region: "Alberta", city: "Calgary",
      neighborhood: "Beltline", label: "x", language: "en",
      dataforseoLocationCode: null, source: "parsed",
    })
  ).toBe("Beltline, Calgary, Alberta, Canada");

  expect(
    localeLabel({
      country: null, countryCode: null, region: null, city: null,
      neighborhood: null, label: "", language: "en",
      dataforseoLocationCode: null, source: "parsed",
    })
  ).toBe("unspecified");
});
