// The content specialist agents. Brand-aware; one engine serves every tenant.
// Content is written for real E-E-A-T depth (Experience, Expertise,
// Authoritativeness, Trust) — not thin filler — because that is what ranks.

import { callClaude } from "../anthropic";
import { brandBlock, type Brand } from "../brands";

export async function writeContent(brand: Brand, keyword: string, pageType: string) {
  return callClaude({
    maxTokens: 4000,
    user: `${brandBlock(brand)}

TASK: Write a comprehensive, genuinely useful ${pageType} targeting the primary keyword "${keyword}".

WRITE FOR E-E-A-T (this is how Google decides if it ranks):
- EXPERIENCE: include specifics only a real local operator would know — local disposal/recycling rules, which materials cost extra, realistic price ranges in CAD, seasonal/local factors, real logistics.
- EXPERTISE: accurate, detailed how-to and what-to-expect information.
- AUTHORITY: reference the service area, credentials, and process confidently.
- TRUST: honest about pricing/what's included; no hype, no empty filler.

SEO RULES (modern, not keyword-stuffing):
- ONE primary keyword ("${keyword}") used naturally in the title, H1, first paragraph, and a couple of headings — plus natural local variations. Do NOT repeat it unnaturally.
- Structure with H2s that answer real questions people search (use question-style H2s where natural — this also helps AI assistants quote you).
- Cover the topic COMPLETELY and in depth — aim for 1200-1800 words of genuinely useful content. Do NOT write a short or thin post; a shallow post will not rank. Include enough real local detail, examples, and step-by-step specifics to fully satisfy the searcher.
- Include a short FAQ section (3-5 real questions) near the end — great for featured snippets AND for AI assistants (ChatGPT/Gemini) that pull direct answers.
- Add 2-3 internal-link suggestions to relevant service/city pages (write them as [anchor text](/suggested-path)).
- End with a clear, specific call to action.

Return clean markdown starting with exactly these two lines:
TITLE TAG: <=60 chars, keyword-forward
META: <=155 chars, benefit + CTA
then the full article body.`,
  });
}

export async function rewriteMeta(brand: Brand, url: string, currentContext: string) {
  return callClaude({
    maxTokens: 700,
    user: `${brandBlock(brand)}

TASK: This page underperforms on click-through: ${url}. Context: ${currentContext}
Write 3 title tag options (<=60 chars, keyword-forward, locally relevant) and 3 meta descriptions (<=155 chars, benefit + CTA).
Return ONLY JSON: {"titles":["..."],"metas":["..."],"why":"one line on the angle"}`,
  });
}

export async function auditPage(brand: Brand, keyword: string, content: string) {
  return callClaude({
    maxTokens: 1600,
    user: `${brandBlock(brand)}

TASK: Audit this page for the primary keyword "${keyword}". Content:
"""${content || "(no content provided — flag what a page targeting this keyword must include to pass E-E-A-T and rank)"}"""
Return ONLY JSON:
{"score":0-100,"checks":[{"item":"...","status":"pass|warn|fail","fix":"..."}],"schema":"schema.org type + why"}
Cover: title, meta, H1, headings, keyword usage, local specifics/E-E-A-T, internal links, FAQ/answer-content for AI assistants, CTA, readability, schema.`,
  });
}
