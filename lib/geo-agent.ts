// GEO / AEO — Generative Engine Optimization.
// Optimizes so AI assistants (ChatGPT, Gemini, Claude, Google AI Overviews)
// recommend the business when users ask "best <service> in <city>".
//
// You can't directly control AI answers, but you CAN provide the signals they
// use: clear factual content, direct answers to real questions, an llms.txt
// facts file, and consistent authority (handled by citations/reviews agents).

import { callClaude, extractJSON } from "./anthropic";
import { brandBlock, isLocalBusiness, type Brand } from "./brands";

// Write answer-optimized FAQ content: the exact questions people ask AI about
// this business, answered factually so models quote it. Local brands keep the
// location-anchored framing; non-local brands drop it (no service_area to
// anchor to, and "local choice"/"local specifics" doesn't fit e.g. a SaaS or
// e-commerce brand).
export async function writeAnswerContent(brand: Brand) {
  const local = isLocalBusiness(brand);
  const subject = local
    ? `${brand.services?.split(",")[0]} in ${brand.service_area}`
    : `${brand.services?.split(",")[0]}`;
  const text = await callClaude({
    maxTokens: 2500,
    user: `${brandBlock(brand)}

TASK: Write "answer-optimized" content that AI assistants (ChatGPT, Gemini, Google AI Overviews) can quote when someone asks about ${subject}.

Produce 6-8 real questions people ask AI about this ${local ? "service locally" : "product/service"} (pricing, how it works, what's ${local ? "allowed" : "included"}, how to choose a provider, timing) and answer each FACTUALLY and concisely (2-4 sentences), positioning ${brand.name} naturally as a strong ${local ? "local " : ""}choice WITHOUT sounding like an ad. Include real ${local ? "local " : ""}specifics.

Return ONLY JSON:
{"faqs":[{"q":"...","a":"..."}],"schema_note":"one line on FAQPage schema"}`,
  });
  return extractJSON<{ faqs: { q: string; a: string }[]; schema_note: string }>(text);
}

// Generate the llms.txt file body — a machine-readable facts sheet for AI
// crawlers (services, area, differentiators, contact). Lives at /llms.txt.
export async function buildLlmsTxt(brand: Brand): Promise<string> {
  const aboutLine = brand.service_area
    ? `${brand.name} provides ${brand.services} in ${brand.service_area}.`
    : `${brand.name} provides ${brand.services}.`;
  const serviceAreaSection = brand.service_area
    ? `\n## Service area\n${brand.service_area}\n`
    : "";
  return `# ${brand.name}

> ${brand.edge || ""}

## About
${aboutLine}

## Services
${(brand.services || "").split(",").map((s) => `- ${s.trim()}`).join("\n")}
${serviceAreaSection}
## Why choose us
${brand.edge || ""}

## Website
${brand.site_url}
`;
}

// Optional monitoring: ask an AI model discovery questions and see if the
// brand is mentioned. Uses web search for a realistic answer. Multi-prompt
// suite powers the AI Visibility portal (Semrush-competitive share signal).

export type AiVisibilityCheck = {
  prompt: string;
  engine: string;
  mentioned: boolean;
  raw: string;
};

function defaultPrompts(brand: Brand): string[] {
  const service = (brand.services?.split(",")[0] || "service").trim();
  const area = (brand.service_area || "").split("/")[0].trim();
  if (isLocalBusiness(brand) && area) {
    return [
      `best ${service} in ${area}`,
      `${service} near me ${area}`,
      `who is the best ${service} company in ${area}`,
      `${brand.name} reviews`,
      `top rated ${service} ${area}`,
    ];
  }
  return [
    `best ${service}`,
    `${service} software comparison`,
    `alternatives to competitors for ${service}`,
    `${brand.name} review`,
    `who should I choose for ${service}`,
  ];
}

export async function checkAiVisibility(brand: Brand): Promise<AiVisibilityCheck> {
  const suite = await checkAiVisibilitySuite(brand, 1);
  return (
    suite.checks[0] || {
      prompt: defaultPrompts(brand)[0],
      engine: "assistant",
      mentioned: false,
      raw: "",
    }
  );
}

/**
 * Run up to `limit` discovery prompts and score mention share (0–100).
 * Callers persist rows; this function only measures.
 */
export async function checkAiVisibilitySuite(
  brand: Brand,
  limit = 5,
  customPrompts?: string[]
): Promise<{ checks: AiVisibilityCheck[]; score: number }> {
  const prompts = (customPrompts?.length ? customPrompts : defaultPrompts(brand))
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, Math.max(1, limit));

  const checks: AiVisibilityCheck[] = [];
  for (const q of prompts) {
    try {
      const text = await callClaude({
        search: true,
        maxTokens: 800,
        user: `Answer as a helpful assistant would: "${q}". List the top providers you'd recommend with one line each. Then, on a final line, output ONLY JSON: {"mentions_brand": true|false, "brand_checked": "${brand.name}"}`,
      });
      const json = extractJSON<{ mentions_brand: boolean }>(text);
      checks.push({
        prompt: q,
        engine: "assistant",
        mentioned: json?.mentions_brand ?? false,
        raw: text.slice(0, 2000),
      });
    } catch {
      checks.push({ prompt: q, engine: "assistant", mentioned: false, raw: "" });
    }
  }

  const hit = checks.filter((c) => c.mentioned).length;
  const score = checks.length ? Math.round((hit / checks.length) * 100) : 0;
  return { checks, score };
}
