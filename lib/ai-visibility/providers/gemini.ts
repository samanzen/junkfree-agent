// AI VISIBILITY — Gemini provider.
//
// Uses the Generative Language API with the google_search grounding tool, so the
// answer reflects the live web the way a real Gemini answer does. Grounded
// responses carry a groundingMetadata block whose groundingChunks are the
// sources — that is where "which page got us recommended" comes from on this
// assistant.
//
// Reuses GEMINI_API_KEY, which the platform already sets for image generation
// (lib/images.ts). No new vendor and no new billing relationship is introduced
// by switching this provider on.

import type { AnswerCitation, AssistantAnswer, Locale } from "../types";
import {
  timedAnswer,
  truncateAnswer,
  withAnswerShape,
  type AssistantProvider,
} from "./index";

const MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

type GeminiPart = { text?: string };
type GroundingChunk = { web?: { uri?: string; title?: string } };
type GeminiResponse = {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    groundingMetadata?: { groundingChunks?: GroundingChunk[] };
  }[];
  error?: { message?: string };
};

/**
 * Sources out of a grounded response.
 *
 * `uri` is frequently a Vertex redirect wrapper rather than the publisher URL.
 * It is stored as-is: the domain extractor in ../analyze.ts normalises whatever
 * host it is given, and rewriting a URL we did not resolve would be inventing
 * data. `title` usually carries the real publisher domain, so it is kept too.
 */
function toCitations(res: GeminiResponse): AnswerCitation[] {
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const out: AnswerCitation[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const url = chunk.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: chunk.web?.title || null, position: out.length + 1 });
  }
  return out;
}

export const geminiProvider: AssistantProvider = {
  id: "gemini",
  label: "Gemini",
  requires: "GEMINI_API_KEY",
  available: () => !!process.env.GEMINI_API_KEY,

  ask: (promptText: string, _locale: Locale | null): Promise<AssistantAnswer> =>
    timedAnswer("gemini", MODEL, async () => {
      const key = process.env.GEMINI_API_KEY as string;
      const res = await fetch(ENDPOINT(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: withAnswerShape(promptText) }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0 },
        }),
      });

      const data = (await res.json()) as GeminiResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || `Gemini ${res.status}`);
      }

      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("")
        .trim();

      return { text: truncateAnswer(text), citations: toCitations(data) };
    }),
};
