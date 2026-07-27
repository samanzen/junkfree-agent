// The content specialist agents. Each takes a brand + task and returns a
// finished deliverable. Brand-aware so one engine serves every tenant.

import { callClaude } from "../anthropic";
import { brandBlock, type Brand } from "../brands";

export async function writeContent(brand: Brand, keyword: string, pageType: string) {
  return callClaude({
    maxTokens: 2000,
    user: `${brandBlock(brand)}

TASK: Write a ${pageType} optimised for "${keyword}". SEO-complete: a title tag, meta description, one H1, logical H2/H3s, natural keyword + local variants, a clear call to action, and real E-E-A-T specifics (no fluff). Write in the brand voice.
Return clean markdown starting with two lines:
TITLE TAG: ...
META: ...
then the page body.`,
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
    maxTokens: 1400,
    user: `${brandBlock(brand)}

TASK: Audit this page for the primary keyword "${keyword}". Content:
"""${content || "(no content provided — flag what a page targeting this keyword must include)"}"""
Return ONLY JSON:
{"score":0-100,"checks":[{"item":"...","status":"pass|warn|fail","fix":"..."}],"schema":"schema.org type + why"}
Cover title, meta, H1, headings, keyword usage, internal links, local signals, CTA, readability, schema.`,
  });
}
