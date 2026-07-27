// GEO / AEO — Generative Engine Optimization.
// Optimizes so AI assistants (ChatGPT, Gemini, Claude, Google AI Overviews)
// recommend the business when users ask "best <service> in <city>".
//
// You can't directly control AI answers, but you CAN provide the signals they
// use: clear factual content, direct answers to real questions, an llms.txt
// facts file, and consistent authority (handled by citations/reviews agents).

import { callClaude, extractJSON } from "./anthropic";
import { brandBlock, type Brand } from "./brands";

// Write answer-optimized FAQ content: the exact questions people ask AI about
// local services, answered factually so models quote the business.
export async function writeAnswerContent(brand: Brand) {
  const text = await callClaude({
    maxTokens: 2500,
    user: `${brandBlock(brand)}

TASK: Write "answer-optimized" content that AI assistants (ChatGPT, Gemini, Google AI Overviews) can quote when someone asks about ${brand.services?.split(",")[0]} in ${brand.service_area}.

Produce 6-8 real questions people ask AI about this service locally (pricing, how it works, what's allowed, how to choose a provider, timing) and answer each FACTUALLY and concisely (2-4 sentences), positioning ${brand.name} naturally as a strong local choice WITHOUT sounding like an ad. Include real local specifics.

Return ONLY JSON:
{"faqs":[{"q":"...","a":"..."}],"schema_note":"one line on FAQPage schema"}`,
  });
  return extractJSON<{ faqs: { q: string; a: string }[]; schema_note: string }>(text);
}

// Generate the llms.txt file body — a machine-readable facts sheet for AI
// crawlers (services, area, differentiators, contact). Lives at /llms.txt.
export async function buildLlmsTxt(brand: Brand): Promise<string> {
  return `# ${brand.name}

> ${brand.edge || ""}

## About
${brand.name} provides ${brand.services} in ${brand.service_area}.

## Services
${(brand.services || "").split(",").map((s) => `- ${s.trim()}`).join("\n")}

## Service area
${brand.service_area}

## Why choose us
${brand.edge || ""}

## Website
${brand.site_url}
`;
}

// Optional monitoring: ask an AI model a discovery question and see if the
// brand is mentioned. Uses web search for a realistic answer.
export async function checkAiVisibility(brand: Brand) {
  const q = `best ${brand.services?.split(",")[0]} in ${(brand.service_area || "").split("/")[0]}`;
  const text = await callClaude({
    search: true,
    maxTokens: 800,
    user: `Answer as a helpful assistant would: "${q}". List the top providers you'd recommend with one line each. Then, on a final line, output ONLY JSON: {"mentions_brand": true|false, "brand_checked": "${brand.name}"}`,
  });
  const json = extractJSON<{ mentions_brand: boolean }>(text);
  return { query: q, mentioned: json?.mentions_brand ?? false, raw: text };
}
