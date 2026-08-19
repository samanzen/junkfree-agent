// AI VISIBILITY — prompt generation.
//
// A prompt is (intent template x service x locale x language). Together those
// four axes are what "everything we need to know" reduces to: WHAT was asked,
// about WHICH service, for WHERE, in WHICH language. Every row the report can
// group by is one of those axes, which is why they are generated explicitly
// rather than assembled ad hoc at call time.
//
// Two properties matter and are tested:
//
//  1. `promptKey` is deterministic. The same question keeps the same key across
//     runs, so "have we gained or lost on THIS question" is answerable. Change
//     a template's wording and the key changes on purpose — results either side
//     of a rewording are not the same measurement.
//
//  2. Generation is pure. No network, no model call, no clock. The full prompt
//     set for a brand is reproducible from the brand row alone.
//
// Language handling is deliberately honest: a language with no translated
// template set falls back to the English wording AND records the language it
// was actually asked in as `en`, so the stored data never claims a question was
// asked in Japanese when it was asked in English.
//
// KNOWN LIMITATION. The template is translated; the brand's own service names
// and place names are not. A French prompt for an English-listed service reads
// "meilleur junk removal à Montréal". That is left as-is on purpose: machine
// translating a customer's service terminology would invent words they do not
// use and measure a business we are not describing. Mixed-language queries are
// also genuinely common in bilingual markets. A brand that wants fully
// localised wording should have its service names entered in that language.

import type { Brand } from "../brands";
import { isLocalBusiness } from "../brands";
import type { Locale, PromptIntent, VisibilityPrompt } from "./types";

/** A question shape, with `{service}`, `{place}`, `{brand}` and `{competitor}`
 *  placeholders. `placeless` is the wording used when there is no place — a
 *  national or global brand — rather than leaving a dangling "in". */
type Template = {
  id: string;
  intent: PromptIntent;
  text: string;
  placeless?: string;
  /** Needs a competitor name to render. */
  needsCompetitor?: boolean;
  /** Needs the brand's own name to render. */
  needsBrand?: boolean;
  /**
   * Render for the primary service only, rather than once per service.
   *
   * "What are the alternatives to X" is a question about the competitor, not
   * about a particular service line, so asking it once per service produces
   * near-identical questions that spend the run's budget without adding
   * information.
   */
  primaryServiceOnly?: boolean;
};

/**
 * Relative importance per intent, used when a cap has to trim the set.
 *
 * Ordered by how close the question is to a buying decision: someone asking
 * "who should I hire" is further along than someone asking "how much does it
 * cost", and being absent from the first costs more.
 */
const INTENT_WEIGHT: Record<PromptIntent, number> = {
  recommendation: 100,
  discovery: 95,
  problem: 90,
  trust: 85,
  comparison: 80,
  proximity: 75,
  price: 70,
  brand: 65,
  alternative: 60,
};

/** The English template set — the reference wording every translation mirrors. */
const TEMPLATES_EN: Template[] = [
  { id: "discovery_best", intent: "discovery", text: "best {service} in {place}", placeless: "best {service}" },
  { id: "recommendation_hire", intent: "recommendation", text: "Who should I hire for {service} in {place}?", placeless: "Who should I hire for {service}?" },
  { id: "problem_need", intent: "problem", text: "I need {service} in {place}. Which companies do you recommend?", placeless: "I need {service}. Which companies do you recommend?" },
  { id: "trust_reliable", intent: "trust", text: "Which {service} company in {place} is the most reliable and trustworthy?", placeless: "Which {service} company is the most reliable and trustworthy?" },
  { id: "comparison_top", intent: "comparison", text: "What are the top 5 {service} companies in {place}?", placeless: "What are the top 5 {service} companies?" },
  { id: "proximity_near", intent: "proximity", text: "{service} near {place}", placeless: "{service} near me" },
  { id: "price_cost", intent: "price", text: "How much does {service} cost in {place}, and who offers good value?", placeless: "How much does {service} cost, and who offers good value?" },
  { id: "brand_check", intent: "brand", text: "Is {brand} a good choice for {service} in {place}?", placeless: "Is {brand} a good choice for {service}?", needsBrand: true },
  { id: "alternative_to", intent: "alternative", text: "What are the alternatives to {competitor} for {service} in {place}?", placeless: "What are the alternatives to {competitor} for {service}?", needsCompetitor: true, primaryServiceOnly: true },
];

/**
 * Translated template sets.
 *
 * Only languages whose wording is written out here are asked in that language.
 * Everything else falls back to English via `templatesFor`, and the fallback is
 * recorded in the prompt's `language` field so the data stays truthful.
 */
const TEMPLATES: Record<string, Template[]> = {
  en: TEMPLATES_EN,

  fr: [
    { id: "discovery_best", intent: "discovery", text: "meilleur {service} à {place}", placeless: "meilleur {service}" },
    { id: "recommendation_hire", intent: "recommendation", text: "Qui devrais-je engager pour {service} à {place} ?", placeless: "Qui devrais-je engager pour {service} ?" },
    { id: "problem_need", intent: "problem", text: "J'ai besoin de {service} à {place}. Quelles entreprises recommandez-vous ?", placeless: "J'ai besoin de {service}. Quelles entreprises recommandez-vous ?" },
    { id: "trust_reliable", intent: "trust", text: "Quelle entreprise de {service} à {place} est la plus fiable ?", placeless: "Quelle entreprise de {service} est la plus fiable ?" },
    { id: "comparison_top", intent: "comparison", text: "Quelles sont les 5 meilleures entreprises de {service} à {place} ?", placeless: "Quelles sont les 5 meilleures entreprises de {service} ?" },
    { id: "proximity_near", intent: "proximity", text: "{service} près de {place}", placeless: "{service} près de moi" },
    { id: "price_cost", intent: "price", text: "Combien coûte {service} à {place}, et qui offre le meilleur rapport qualité-prix ?", placeless: "Combien coûte {service}, et qui offre le meilleur rapport qualité-prix ?" },
    { id: "brand_check", intent: "brand", text: "Est-ce que {brand} est un bon choix pour {service} à {place} ?", placeless: "Est-ce que {brand} est un bon choix pour {service} ?", needsBrand: true },
    { id: "alternative_to", intent: "alternative", text: "Quelles sont les alternatives à {competitor} pour {service} à {place} ?", placeless: "Quelles sont les alternatives à {competitor} pour {service} ?", needsCompetitor: true, primaryServiceOnly: true },
  ],

  es: [
    { id: "discovery_best", intent: "discovery", text: "mejor {service} en {place}", placeless: "mejor {service}" },
    { id: "recommendation_hire", intent: "recommendation", text: "¿A quién debería contratar para {service} en {place}?", placeless: "¿A quién debería contratar para {service}?" },
    { id: "problem_need", intent: "problem", text: "Necesito {service} en {place}. ¿Qué empresas recomiendas?", placeless: "Necesito {service}. ¿Qué empresas recomiendas?" },
    { id: "trust_reliable", intent: "trust", text: "¿Qué empresa de {service} en {place} es la más confiable?", placeless: "¿Qué empresa de {service} es la más confiable?" },
    { id: "comparison_top", intent: "comparison", text: "¿Cuáles son las 5 mejores empresas de {service} en {place}?", placeless: "¿Cuáles son las 5 mejores empresas de {service}?" },
    { id: "proximity_near", intent: "proximity", text: "{service} cerca de {place}", placeless: "{service} cerca de mí" },
    { id: "price_cost", intent: "price", text: "¿Cuánto cuesta {service} en {place} y quién ofrece buena relación calidad-precio?", placeless: "¿Cuánto cuesta {service} y quién ofrece buena relación calidad-precio?" },
    { id: "brand_check", intent: "brand", text: "¿Es {brand} una buena opción para {service} en {place}?", placeless: "¿Es {brand} una buena opción para {service}?", needsBrand: true },
    { id: "alternative_to", intent: "alternative", text: "¿Cuáles son las alternativas a {competitor} para {service} en {place}?", placeless: "¿Cuáles son las alternativas a {competitor} para {service}?", needsCompetitor: true, primaryServiceOnly: true },
  ],

  de: [
    { id: "discovery_best", intent: "discovery", text: "beste {service} in {place}", placeless: "beste {service}" },
    { id: "recommendation_hire", intent: "recommendation", text: "Wen sollte ich für {service} in {place} beauftragen?", placeless: "Wen sollte ich für {service} beauftragen?" },
    { id: "problem_need", intent: "problem", text: "Ich brauche {service} in {place}. Welche Firmen empfiehlst du?", placeless: "Ich brauche {service}. Welche Firmen empfiehlst du?" },
    { id: "trust_reliable", intent: "trust", text: "Welche {service}-Firma in {place} ist am zuverlässigsten?", placeless: "Welche {service}-Firma ist am zuverlässigsten?" },
    { id: "comparison_top", intent: "comparison", text: "Was sind die 5 besten {service}-Firmen in {place}?", placeless: "Was sind die 5 besten {service}-Firmen?" },
    { id: "proximity_near", intent: "proximity", text: "{service} in der Nähe von {place}", placeless: "{service} in meiner Nähe" },
    { id: "price_cost", intent: "price", text: "Was kostet {service} in {place}, und wer bietet ein gutes Preis-Leistungs-Verhältnis?", placeless: "Was kostet {service}, und wer bietet ein gutes Preis-Leistungs-Verhältnis?" },
    { id: "brand_check", intent: "brand", text: "Ist {brand} eine gute Wahl für {service} in {place}?", placeless: "Ist {brand} eine gute Wahl für {service}?", needsBrand: true },
    { id: "alternative_to", intent: "alternative", text: "Welche Alternativen zu {competitor} gibt es für {service} in {place}?", placeless: "Welche Alternativen zu {competitor} gibt es für {service}?", needsCompetitor: true, primaryServiceOnly: true },
  ],

  it: [
    { id: "discovery_best", intent: "discovery", text: "migliore {service} a {place}", placeless: "migliore {service}" },
    { id: "recommendation_hire", intent: "recommendation", text: "Chi dovrei assumere per {service} a {place}?", placeless: "Chi dovrei assumere per {service}?" },
    { id: "problem_need", intent: "problem", text: "Ho bisogno di {service} a {place}. Quali aziende consigli?", placeless: "Ho bisogno di {service}. Quali aziende consigli?" },
    { id: "trust_reliable", intent: "trust", text: "Quale azienda di {service} a {place} è la più affidabile?", placeless: "Quale azienda di {service} è la più affidabile?" },
    { id: "comparison_top", intent: "comparison", text: "Quali sono le 5 migliori aziende di {service} a {place}?", placeless: "Quali sono le 5 migliori aziende di {service}?" },
    { id: "proximity_near", intent: "proximity", text: "{service} vicino a {place}", placeless: "{service} vicino a me" },
    { id: "price_cost", intent: "price", text: "Quanto costa {service} a {place} e chi offre un buon rapporto qualità-prezzo?", placeless: "Quanto costa {service} e chi offre un buon rapporto qualità-prezzo?" },
    { id: "brand_check", intent: "brand", text: "{brand} è una buona scelta per {service} a {place}?", placeless: "{brand} è una buona scelta per {service}?", needsBrand: true },
    { id: "alternative_to", intent: "alternative", text: "Quali sono le alternative a {competitor} per {service} a {place}?", placeless: "Quali sono le alternative a {competitor} per {service}?", needsCompetitor: true, primaryServiceOnly: true },
  ],

  pt: [
    { id: "discovery_best", intent: "discovery", text: "melhor {service} em {place}", placeless: "melhor {service}" },
    { id: "recommendation_hire", intent: "recommendation", text: "Quem devo contratar para {service} em {place}?", placeless: "Quem devo contratar para {service}?" },
    { id: "problem_need", intent: "problem", text: "Preciso de {service} em {place}. Quais empresas você recomenda?", placeless: "Preciso de {service}. Quais empresas você recomenda?" },
    { id: "trust_reliable", intent: "trust", text: "Qual empresa de {service} em {place} é a mais confiável?", placeless: "Qual empresa de {service} é a mais confiável?" },
    { id: "comparison_top", intent: "comparison", text: "Quais são as 5 melhores empresas de {service} em {place}?", placeless: "Quais são as 5 melhores empresas de {service}?" },
    { id: "proximity_near", intent: "proximity", text: "{service} perto de {place}", placeless: "{service} perto de mim" },
    { id: "price_cost", intent: "price", text: "Quanto custa {service} em {place} e quem oferece bom custo-benefício?", placeless: "Quanto custa {service} e quem oferece bom custo-benefício?" },
    { id: "brand_check", intent: "brand", text: "A {brand} é uma boa escolha para {service} em {place}?", placeless: "A {brand} é uma boa escolha para {service}?", needsBrand: true },
    { id: "alternative_to", intent: "alternative", text: "Quais são as alternativas à {competitor} para {service} em {place}?", placeless: "Quais são as alternativas à {competitor} para {service}?", needsCompetitor: true, primaryServiceOnly: true },
  ],

  nl: [
    { id: "discovery_best", intent: "discovery", text: "beste {service} in {place}", placeless: "beste {service}" },
    { id: "recommendation_hire", intent: "recommendation", text: "Wie moet ik inhuren voor {service} in {place}?", placeless: "Wie moet ik inhuren voor {service}?" },
    { id: "problem_need", intent: "problem", text: "Ik heb {service} nodig in {place}. Welke bedrijven raad je aan?", placeless: "Ik heb {service} nodig. Welke bedrijven raad je aan?" },
    { id: "trust_reliable", intent: "trust", text: "Welk {service}-bedrijf in {place} is het meest betrouwbaar?", placeless: "Welk {service}-bedrijf is het meest betrouwbaar?" },
    { id: "comparison_top", intent: "comparison", text: "Wat zijn de 5 beste {service}-bedrijven in {place}?", placeless: "Wat zijn de 5 beste {service}-bedrijven?" },
    { id: "proximity_near", intent: "proximity", text: "{service} in de buurt van {place}", placeless: "{service} in mijn buurt" },
    { id: "price_cost", intent: "price", text: "Wat kost {service} in {place}, en wie biedt een goede prijs-kwaliteitverhouding?", placeless: "Wat kost {service}, en wie biedt een goede prijs-kwaliteitverhouding?" },
    { id: "brand_check", intent: "brand", text: "Is {brand} een goede keuze voor {service} in {place}?", placeless: "Is {brand} een goede keuze voor {service}?", needsBrand: true },
    { id: "alternative_to", intent: "alternative", text: "Wat zijn de alternatieven voor {competitor} voor {service} in {place}?", placeless: "Wat zijn de alternatieven voor {competitor} voor {service}?", needsCompetitor: true, primaryServiceOnly: true },
  ],
};

/** Languages we have real wording for. Anything else is asked in English. */
export function supportedPromptLanguages(): string[] {
  return Object.keys(TEMPLATES);
}

/**
 * The template set and the language it is actually written in.
 *
 * Returning both is what keeps the stored `language` honest: an unsupported
 * language resolves to the English set AND reports "en".
 */
export function templatesFor(language: string): { templates: Template[]; language: string } {
  const key = (language || "en").toLowerCase().split("-")[0];
  const set = TEMPLATES[key];
  return set ? { templates: set, language: key } : { templates: TEMPLATES_EN, language: "en" };
}

/** Split a comma-separated brand field into clean values. */
export function splitList(raw: string | null | undefined, limit = 10): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, limit);
}

/** Lowercase, accent-free, single-spaced — for keys only, never for display. */
function keyPart(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The stable identifier for a question.
 *
 * Built from the four axes and nothing else — no timestamp, no run id, no
 * random component — which is precisely what allows a question's history to be
 * queried across runs.
 */
export function promptKeyOf(input: {
  templateId: string;
  service: string | null;
  localeLabel: string | null;
  language: string;
}): string {
  return [
    keyPart(input.templateId),
    keyPart(input.service || "all"),
    keyPart(input.localeLabel || "any"),
    keyPart(input.language),
  ].join("|");
}

export type PromptGenerationOptions = {
  /** How many services to cover, most important (listed first) wins. */
  maxServices?: number;
  /** How many competitors to generate `alternative` prompts for. */
  maxCompetitors?: number;
  /** Restrict to these intents. Defaults to every intent. */
  intents?: PromptIntent[];
  /** Hard ceiling on the returned set, applied after weight ordering. */
  limit?: number;
};

/**
 * Generate every question worth asking for a brand, ordered by weight.
 *
 * The caller passes locales in (from ./locales.ts) rather than having them
 * derived here, so a brand's explicitly configured locales and its parsed ones
 * flow through the same code path.
 */
export function generatePrompts(
  brand: Brand,
  locales: Locale[],
  opts: PromptGenerationOptions = {}
): VisibilityPrompt[] {
  const services = splitList(brand.services, opts.maxServices ?? 4);
  const competitors = splitList(brand.competitors, opts.maxCompetitors ?? 2);
  const wantedIntents = opts.intents;
  const local = isLocalBusiness(brand);

  // A brand with no services listed still deserves measuring — fall back to a
  // single null service, which renders the templates without the service clause
  // filled from a guess.
  const serviceList: (string | null)[] = services.length ? services : [null];

  // No locales at all (no service area, nothing configured) still yields the
  // placeless variants, so a brand is never silently unmeasured.
  const localeList: (Locale | null)[] = locales.length ? locales : [null];

  const out: VisibilityPrompt[] = [];
  const seen = new Set<string>();

  for (const locale of localeList) {
    const { templates, language } = templatesFor(locale?.language || "en");
    const place = locale?.label?.trim() || "";
    // A local brand with no usable place falls back to the placeless wording
    // rather than emitting "best plumber in ".
    const usePlaceless = !place || !local;

    for (const template of templates) {
      if (wantedIntents && !wantedIntents.includes(template.intent)) continue;

      const pattern = usePlaceless ? template.placeless || template.text : template.text;
      // A template with no placeless wording cannot be rendered without a place.
      if (usePlaceless && !template.placeless) continue;

      const servicesForTemplate = template.primaryServiceOnly
        ? serviceList.slice(0, 1)
        : serviceList;

      for (const service of servicesForTemplate) {
        // `{service}` is in every template, so a null service cannot render.
        if (!service && pattern.includes("{service}")) continue;

        const competitorsForTemplate = template.needsCompetitor ? competitors : [null];
        for (const competitor of competitorsForTemplate) {
          if (template.needsCompetitor && !competitor) continue;

          const text = pattern
            .replace(/\{service\}/g, service || "")
            .replace(/\{place\}/g, place)
            .replace(/\{brand\}/g, brand.name)
            .replace(/\{competitor\}/g, competitor || "")
            .replace(/\s+/g, " ")
            .trim();
          if (!text) continue;

          // The competitor is part of the question's identity, so it belongs in
          // the key — otherwise two rivals would collapse onto one row.
          const templateId = competitor ? `${template.id}:${keyPart(competitor)}` : template.id;
          const promptKey = promptKeyOf({
            templateId,
            service,
            localeLabel: locale?.label || null,
            language,
          });
          if (seen.has(promptKey)) continue;
          seen.add(promptKey);

          // Finer grain and secondary services are the first things a cap
          // should drop: being absent across a whole city matters more than
          // being absent in one of its neighbourhoods.
          let weight = INTENT_WEIGHT[template.intent];
          if (locale?.neighborhood) weight -= 15;
          if (service && services.indexOf(service) > 0) weight -= 5 * services.indexOf(service);
          if (locale && locale.language !== (brand.dataforseo_language_code || "en")) weight -= 10;

          out.push({
            promptKey,
            intent: template.intent,
            templateId,
            service,
            language,
            locale,
            text,
            weight: Math.max(1, weight),
          });
        }
      }
    }
  }

  // Stable ordering: weight first, then key, so an unchanged brand produces an
  // identical list every time and a cap always trims the same tail.
  out.sort((a, b) => b.weight - a.weight || a.promptKey.localeCompare(b.promptKey));

  return opts.limit ? out.slice(0, opts.limit) : out;
}
