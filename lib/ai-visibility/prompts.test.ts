import { test, expect } from "vitest";
import {
  generatePrompts,
  promptKeyOf,
  splitList,
  supportedPromptLanguages,
  templatesFor,
} from "./prompts";
import { deriveLocales } from "./locales";
import type { Brand } from "../brands";
import type { Locale } from "./types";

function brand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: "b1",
    slug: "acme",
    name: "Acme Junk Removal",
    site_url: "https://acme.ca",
    gsc_property: null,
    gbp_location_id: null,
    service_area: "Calgary",
    services: "junk removal, hot tub removal",
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

function locale(overrides: Partial<Locale> = {}): Locale {
  return {
    country: "Canada",
    countryCode: "CA",
    region: "Alberta",
    city: "Calgary",
    neighborhood: null,
    label: "Calgary",
    language: "en",
    dataforseoLocationCode: 2124,
    source: "parsed",
    ...overrides,
  };
}

// ── Keys ────────────────────────────────────────────────────────────────────
test("a prompt key is stable and built only from the four axes", () => {
  const a = promptKeyOf({ templateId: "discovery_best", service: "junk removal", localeLabel: "Calgary", language: "en" });
  const b = promptKeyOf({ templateId: "discovery_best", service: "Junk Removal", localeLabel: "calgary", language: "EN" });
  expect(a).toBe(b);
  expect(a).toBe("discovery-best|junk-removal|calgary|en");
});

test("changing any axis changes the key", () => {
  const base = { templateId: "discovery_best", service: "junk removal", localeLabel: "Calgary", language: "en" };
  expect(promptKeyOf({ ...base, language: "fr" })).not.toBe(promptKeyOf(base));
  expect(promptKeyOf({ ...base, localeLabel: "Airdrie" })).not.toBe(promptKeyOf(base));
  expect(promptKeyOf({ ...base, service: "hot tub removal" })).not.toBe(promptKeyOf(base));
  expect(promptKeyOf({ ...base, templateId: "trust_reliable" })).not.toBe(promptKeyOf(base));
});

test("absent axes get explicit placeholders rather than collapsing", () => {
  expect(promptKeyOf({ templateId: "t", service: null, localeLabel: null, language: "en" })).toBe("t|all|any|en");
});

// ── Language handling ───────────────────────────────────────────────────────
test("a supported language uses its own wording", () => {
  const { templates, language } = templatesFor("fr");
  expect(language).toBe("fr");
  expect(templates.find((t) => t.id === "discovery_best")!.text).toContain("meilleur");
});

test("an unsupported language falls back to English and says so", () => {
  // Reporting "ja" while asking in English would make the stored data lie about
  // what was measured.
  const { templates, language } = templatesFor("ja");
  expect(language).toBe("en");
  expect(templates.find((t) => t.id === "discovery_best")!.text).toContain("best");
});

test("a regional tag resolves to its base language", () => {
  expect(templatesFor("fr-CA").language).toBe("fr");
});

test("every supported language covers the same template ids", () => {
  const reference = templatesFor("en").templates.map((t) => t.id).sort();
  for (const lang of supportedPromptLanguages()) {
    expect(templatesFor(lang).templates.map((t) => t.id).sort(), lang).toEqual(reference);
  }
});

test("every template in every language keeps a placeless variant", () => {
  // Without one, a national brand would get "best plumber in " with a dangling
  // preposition.
  for (const lang of supportedPromptLanguages()) {
    for (const t of templatesFor(lang).templates) {
      expect(t.placeless, `${lang}/${t.id}`).toBeTruthy();
    }
  }
});

// ── Lists ───────────────────────────────────────────────────────────────────
test("brand list fields split and trim", () => {
  expect(splitList("junk removal, hot tub removal")).toEqual(["junk removal", "hot tub removal"]);
  expect(splitList("  a ;  b \n c ")).toEqual(["a", "b", "c"]);
  expect(splitList(null)).toEqual([]);
});

// ── Generation ──────────────────────────────────────────────────────────────
test("a local brand's prompts carry the place", () => {
  const prompts = generatePrompts(brand(), [locale()]);
  const discovery = prompts.find((p) => p.templateId === "discovery_best" && p.service === "junk removal")!;
  expect(discovery.text).toBe("best junk removal in Calgary");
  expect(discovery.locale?.city).toBe("Calgary");
});

test("a non-local brand's prompts drop the place clause entirely", () => {
  const b = brand({ business_model: "saas", services: "invoicing software", service_area: null });
  const prompts = generatePrompts(b, deriveLocales(b));
  expect(prompts.length).toBeGreaterThan(0);
  for (const p of prompts) {
    expect(p.text).not.toMatch(/\bin\s*$/);
    expect(p.text).not.toContain("{place}");
  }
});

test("no placeholder ever survives into a prompt", () => {
  const b = brand({ competitors: "1-800-GOT-JUNK" });
  const prompts = generatePrompts(b, [locale(), locale({ label: "Airdrie", city: "Airdrie" })]);
  for (const p of prompts) {
    expect(p.text).not.toMatch(/\{(service|place|brand|competitor)\}/);
    expect(p.text.trim()).toBe(p.text);
  }
});

test("the brand-check template names the brand and the alternative names a rival", () => {
  const prompts = generatePrompts(brand({ competitors: "1-800-GOT-JUNK" }), [locale()]);
  expect(prompts.find((p) => p.intent === "brand")!.text).toContain("Acme Junk Removal");
  expect(prompts.find((p) => p.intent === "alternative")!.text).toContain("1-800-GOT-JUNK");
});

test("the alternative template is skipped when no competitor is known", () => {
  const prompts = generatePrompts(brand({ competitors: null }), [locale()]);
  expect(prompts.some((p) => p.intent === "alternative")).toBe(false);
});

test("two competitors produce two distinct alternative prompts", () => {
  // Without the competitor in the key they would collapse onto one row.
  const prompts = generatePrompts(brand({ competitors: "GotJunk, BinThere" }), [locale()]);
  const alts = prompts.filter((p) => p.intent === "alternative");
  expect(alts.length).toBe(2);
  expect(new Set(alts.map((p) => p.promptKey)).size).toBe(2);
});

test("the alternative question is asked once per rival, not once per service", () => {
  // "alternatives to X for hot tub removal" adds nothing over "for junk
  // removal" — it is a question about the rival, and asking it per service
  // spends the run's budget on near-identical questions.
  const b = brand({ services: "junk removal, hot tub removal, shed demolition", competitors: "GotJunk" });
  const alts = generatePrompts(b, [locale()]).filter((p) => p.intent === "alternative");
  expect(alts).toHaveLength(1);
  expect(alts[0].service).toBe("junk removal");
});

test("service-specific questions are still asked per service", () => {
  const b = brand({ services: "junk removal, hot tub removal" });
  const discovery = generatePrompts(b, [locale()]).filter((p) => p.intent === "discovery");
  expect(discovery.map((p) => p.service)).toEqual(["junk removal", "hot tub removal"]);
});

test("generation is deterministic", () => {
  const a = generatePrompts(brand(), [locale()]).map((p) => p.promptKey);
  const b = generatePrompts(brand(), [locale()]).map((p) => p.promptKey);
  expect(a).toEqual(b);
});

test("keys are unique within one generation", () => {
  const prompts = generatePrompts(brand({ competitors: "GotJunk" }), [
    locale(),
    locale({ label: "Airdrie", city: "Airdrie" }),
    locale({ label: "Beltline, Calgary", city: "Calgary", neighborhood: "Beltline" }),
  ]);
  expect(new Set(prompts.map((p) => p.promptKey)).size).toBe(prompts.length);
});

test("prompts are ordered by weight, buying-intent questions first", () => {
  const prompts = generatePrompts(brand(), [locale()]);
  for (let i = 1; i < prompts.length; i++) {
    expect(prompts[i - 1].weight).toBeGreaterThanOrEqual(prompts[i].weight);
  }
  expect(prompts[0].intent).toBe("recommendation");
});

test("neighbourhood prompts weigh less than city prompts", () => {
  const prompts = generatePrompts(brand(), [
    locale(),
    locale({ label: "Beltline, Calgary", city: "Calgary", neighborhood: "Beltline" }),
  ]);
  const city = prompts.find((p) => p.intent === "discovery" && !p.locale?.neighborhood)!;
  const hood = prompts.find((p) => p.intent === "discovery" && p.locale?.neighborhood)!;
  expect(hood.weight).toBeLessThan(city.weight);
});

test("secondary services weigh less than the primary one", () => {
  const prompts = generatePrompts(brand(), [locale()]);
  const primary = prompts.find((p) => p.intent === "discovery" && p.service === "junk removal")!;
  const secondary = prompts.find((p) => p.intent === "discovery" && p.service === "hot tub removal")!;
  expect(secondary.weight).toBeLessThan(primary.weight);
});

test("the limit trims the lowest-weighted tail", () => {
  const all = generatePrompts(brand(), [locale()]);
  const capped = generatePrompts(brand(), [locale()], { limit: 5 });
  expect(capped).toHaveLength(5);
  expect(capped.map((p) => p.promptKey)).toEqual(all.slice(0, 5).map((p) => p.promptKey));
});

test("intents can be restricted", () => {
  const prompts = generatePrompts(brand(), [locale()], { intents: ["discovery", "price"] });
  expect(new Set(prompts.map((p) => p.intent))).toEqual(new Set(["discovery", "price"]));
});

test("a brand with no services listed generates nothing rather than a broken prompt", () => {
  // Every template needs a service; inventing one would measure a business we
  // are not describing.
  expect(generatePrompts(brand({ services: null }), [locale()])).toEqual([]);
});

test("a French locale produces French prompts recorded as French", () => {
  const prompts = generatePrompts(brand({ service_area: "Montreal" }), [
    locale({ label: "Montréal", city: "Montréal", language: "fr" }),
  ]);
  const discovery = prompts.find((p) => p.templateId === "discovery_best")!;
  expect(discovery.language).toBe("fr");
  expect(discovery.text).toContain("meilleur");
  expect(discovery.text).toContain("Montréal");
});
