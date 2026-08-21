// AI VISIBILITY — ChatGPT (OpenAI) provider.
//
// Uses the Responses API with the web_search tool, which is the closest
// programmatic equivalent to what a person gets when they ask ChatGPT for a
// recommendation. Sources arrive as url_citation annotations on the output text.
//
// This is the one provider that needs a vendor the platform does not already
// pay for, so it stays off until OPENAI_API_KEY is set. Everything else in the
// module works without it.

import type { AnswerCitation, AssistantAnswer, Locale } from "../types";
import {
  timedAnswer,
  truncateAnswer,
  withAnswerShape,
  type AssistantProvider,
} from "./index";

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const ENDPOINT = "https://api.openai.com/v1/responses";

type Annotation = { type?: string; url?: string; title?: string };
type ContentPart = { type?: string; text?: string; annotations?: Annotation[] };
type OutputItem = { type?: string; content?: ContentPart[] };
type OpenAiResponse = {
  output?: OutputItem[];
  output_text?: string;
  error?: { message?: string };
};

/** Text from the response, tolerating both the convenience field and the
 *  structured output array (only one is present depending on the model). */
function toText(res: OpenAiResponse): string {
  if (typeof res.output_text === "string" && res.output_text.trim()) {
    return res.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of res.output || []) {
    if (item.type && item.type !== "message") continue;
    for (const part of item.content || []) {
      if (typeof part.text === "string") parts.push(part.text);
    }
  }
  return parts.join("").trim();
}

function toCitations(res: OpenAiResponse): AnswerCitation[] {
  const out: AnswerCitation[] = [];
  const seen = new Set<string>();
  for (const item of res.output || []) {
    for (const part of item.content || []) {
      for (const a of part.annotations || []) {
        if (a.type !== "url_citation" || !a.url || seen.has(a.url)) continue;
        seen.add(a.url);
        out.push({ url: a.url, title: a.title || null, position: out.length + 1 });
      }
    }
  }
  return out;
}

export const openaiProvider: AssistantProvider = {
  id: "openai",
  label: "ChatGPT",
  requires: "OPENAI_API_KEY",
  available: () => !!process.env.OPENAI_API_KEY,

  ask: (promptText: string, _locale: Locale | null): Promise<AssistantAnswer> =>
    timedAnswer("openai", MODEL, async () => {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          input: withAnswerShape(promptText),
          tools: [{ type: "web_search" }],
          max_output_tokens: 1200,
        }),
      });

      const data = (await res.json()) as OpenAiResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || `OpenAI ${res.status}`);
      }

      return { text: truncateAnswer(toText(data)), citations: toCitations(data) };
    }),
};
