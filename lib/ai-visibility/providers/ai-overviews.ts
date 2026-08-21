// AI VISIBILITY — Google AI Overview provider.
//
// The odd one out, and the most commercially important: AI Overviews sit above
// the organic results for a large share of queries, so being absent from one is
// a direct loss of the clicks a top-3 ranking used to earn.
//
// There is no API to ask Google's AI Overview a question. It is read off a live
// SERP instead, through the DataForSEO integration the platform already pays
// for (see lib/dataforseo.ts aiOverview). Two consequences shape this adapter:
//
//  * The "prompt" has to be a search query, not a chat question. A template's
//    conversational wording ("Who should I hire for junk removal in Calgary?")
//    is condensed to the query a person would actually type, because sending the
//    full sentence measures a SERP nobody sees.
//
//  * Geo targeting comes from the locale's DataForSEO location code rather than
//    from the words of the prompt, which is how a neighbourhood-level check is
//    actually localised on this assistant.

import { aiOverview } from "../../dataforseo";
import type { AnswerCitation, AssistantAnswer, Locale } from "../types";
import { timedAnswer, truncateAnswer, type AssistantProvider } from "./index";

/** Leading conversational scaffolding that never appears in a typed query. */
const CONVERSATIONAL_PREFIXES = [
  /^who should i hire for\s+/i,
  /^who do you recommend for\s+/i,
  /^what are the (?:top \d+|best)\s+/i,
  /^what are the alternatives to\s+/i,
  /^which\s+/i,
  /^how much does\s+/i,
  /^is\s+/i,
  /^i need\s+/i,
];

/** Trailing clauses that are conversation, not search terms. */
const TRAILING_CLAUSES = [
  /,?\s+and who offers good value$/i,
  /\s+is the most reliable(?:\s+and trustworthy)?$/i,
  /,?\s+(?:which|what) companies do you recommend$/i,
  /\s+do you recommend$/i,
];

/**
 * Words that describe the KIND of result rather than the thing searched for.
 * A person types "junk removal in Calgary", not "junk removal companies in
 * Calgary", so these are dropped wherever they appear.
 */
const RESULT_NOUNS = /\s+(?:companies|company|providers|provider|services|firms|businesses)\b/gi;

/**
 * Condense a conversational prompt into a search query.
 *
 * Deliberately simple and lossy. A SERP query is a different medium from a chat
 * turn: sending "Who should I hire for junk removal in Calgary?" to a search
 * engine measures a results page nobody sees, so the scaffolding is stripped
 * down to the terms a person would actually type.
 */
export function toSearchQuery(promptText: string): string {
  let q = (promptText || "").split(/[?.!]\s|[?.!]$/)[0].trim();

  for (const prefix of CONVERSATIONAL_PREFIXES) q = q.replace(prefix, "");
  for (const clause of TRAILING_CLAUSES) q = q.replace(clause, "");

  q = q
    .replace(RESULT_NOUNS, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();

  return q.slice(0, 120);
}

function toCitations(refs: { url: string; title: string | null }[]): AnswerCitation[] {
  return refs.map((r, i) => ({ url: r.url, title: r.title, position: i + 1 }));
}

export const aiOverviewProvider: AssistantProvider = {
  id: "ai_overview",
  label: "Google AI Overview",
  requires: "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD",
  available: () => !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),

  ask: (promptText: string, locale: Locale | null): Promise<AssistantAnswer> =>
    timedAnswer("ai_overview", "google-ai-overview", async () => {
      const query = toSearchQuery(promptText);
      const { result, reason } = await aiOverview(query, {
        locationCode: locale?.dataforseoLocationCode ?? undefined,
        languageCode: locale?.language,
      });

      if (reason === "unconfigured") throw new Error("DataForSEO credentials are not configured");
      if (reason === "request_failed") throw new Error("DataForSEO SERP request failed");

      // A SERP with no AI Overview is a real, meaningful observation — Google
      // chose not to generate one for this query — so it is returned as an
      // empty answer rather than an error. The check records "not mentioned",
      // which is correct: there was no answer to be mentioned in.
      if (reason === "no_block" || !result) return { text: "", citations: [] };

      return { text: truncateAnswer(result.text), citations: toCitations(result.references) };
    }),
};
