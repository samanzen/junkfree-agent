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
export async function writeAnswerContent(
  brand: Brand,
  /**
   * A specific question to answer, supplied by the AI-visibility sweep when an
   * assistant answered that exact question without naming this business
   * (lib/ai-visibility/analyst.ts). Omitted for the generic FAQ pass, which
   * behaves exactly as it did before this parameter existed.
   */
  focus?: { question: string }
) {
  const local = isLocalBusiness(brand);
  const subject = local
    ? `${brand.services?.split(",")[0]} in ${brand.service_area}`
    : `${brand.services?.split(",")[0]}`;

  // The targeted variant leads with the losing question and then covers the
  // follow-ups a reader would have, because an assistant quoting one answer
  // usually needs the surrounding context to trust it.
  const task = focus
    ? `TASK: An AI assistant was asked "${focus.question}" and did NOT mention ${brand.name}. Write "answer-optimized" content that answers exactly that question, so assistants can quote it.

Produce 5-7 questions. The FIRST must directly answer "${focus.question}". The rest are the natural follow-ups someone asking it would have. Answer each FACTUALLY and concisely (2-4 sentences), positioning ${brand.name} as a genuine, specific answer WITHOUT sounding like an ad — assistants discount promotional copy. Include real ${local ? "local " : ""}specifics: names, areas served, what is and is not included, realistic figures.`
    : `TASK: Write "answer-optimized" content that AI assistants (ChatGPT, Gemini, Google AI Overviews) can quote when someone asks about ${subject}.

Produce 6-8 real questions people ask AI about this ${local ? "service locally" : "product/service"} (pricing, how it works, what's ${local ? "allowed" : "included"}, how to choose a provider, timing) and answer each FACTUALLY and concisely (2-4 sentences), positioning ${brand.name} naturally as a strong ${local ? "local " : ""}choice WITHOUT sounding like an ad. Include real ${local ? "local " : ""}specifics.`;

  const text = await callClaude({
    maxTokens: 2500,
    user: `${brandBlock(brand)}

${task}

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

// checkAiVisibility used to live here: one discovery question, asked of one
// model, reduced to a boolean. It has been replaced by lib/ai-visibility, which
// asks many questions across assistants, places and languages and keeps the
// whole answer. Deleted rather than left in place, so there is exactly one
// AI-visibility implementation to reason about.
