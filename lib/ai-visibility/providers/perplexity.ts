// AI VISIBILITY — Perplexity provider.
//
// Worth measuring separately from the others because Perplexity is search-first:
// every answer is grounded and every answer cites, so it is the assistant where
// "which of our pages earns the citation" is most directly answerable.
//
// OpenAI-compatible chat/completions shape, with sources returned in a
// top-level `citations` (older) or `search_results` (newer) field. Both are
// read, so the provider keeps working across that change.

import type { AnswerCitation, AssistantAnswer, Locale } from "../types";
import {
  timedAnswer,
  truncateAnswer,
  withAnswerShape,
  type AssistantProvider,
} from "./index";

const MODEL = process.env.PERPLEXITY_MODEL || "sonar";
const ENDPOINT = "https://api.perplexity.ai/chat/completions";

type PerplexityResponse = {
  choices?: { message?: { content?: string } }[];
  /** Older shape: a flat list of URLs. */
  citations?: string[];
  /** Newer shape: objects carrying the title too. */
  search_results?: { url?: string; title?: string }[];
  error?: { message?: string } | string;
};

function toCitations(res: PerplexityResponse): AnswerCitation[] {
  const out: AnswerCitation[] = [];
  const seen = new Set<string>();

  for (const r of res.search_results || []) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    out.push({ url: r.url, title: r.title || null, position: out.length + 1 });
  }
  for (const url of res.citations || []) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: null, position: out.length + 1 });
  }

  return out;
}

export const perplexityProvider: AssistantProvider = {
  id: "perplexity",
  label: "Perplexity",
  requires: "PERPLEXITY_API_KEY",
  available: () => !!process.env.PERPLEXITY_API_KEY,

  ask: (promptText: string, _locale: Locale | null): Promise<AssistantAnswer> =>
    timedAnswer("perplexity", MODEL, async () => {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: withAnswerShape(promptText) }],
          max_tokens: 1200,
          temperature: 0,
        }),
      });

      const data = (await res.json()) as PerplexityResponse;
      if (!res.ok || data.error) {
        const message =
          typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(message || `Perplexity ${res.status}`);
      }

      const text = (data.choices?.[0]?.message?.content || "").trim();
      return { text: truncateAnswer(text), citations: toCitations(data) };
    }),
};
