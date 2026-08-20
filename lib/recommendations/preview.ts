// What a recommendation *looks like* when a person opens Preview.
//
// The queue itself only shows a title. This module turns the stored draft
// body into the three shapes a preview can honestly render: a page (markdown,
// including images), a Google search result (meta options), or a Google
// Business Profile post. Pure, so the overlay and the tests share one parser.

import { slugify, splitFrontMatter, stripDraftPrefix } from "../utils";

export type PreviewKind = "page" | "meta" | "google_post" | "audit";

export function unwrapDraftBody(body: string): string {
  return body.replace(/```json/gi, "").replace(/```/g, "").trim();
}

/**
 * Pull a JSON object out of a draft body. Audits are stored as raw model
 * text — often a preamble, fenced JSON, then leftover commentary — so a
 * straight JSON.parse of the whole string misses every real review.
 *
 * Mirrors lib/anthropic extractJSON, but stays in this file so the preview
 * overlay can run in the browser without pulling the model client.
 */
export function parseJsonObject(body: string): Record<string, unknown> | null {
  const t = unwrapDraftBody(body);
  if (!t) return null;

  const asObject = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (Array.isArray(value) && value.length && typeof value[0] === "object") {
      return { checks: value };
    }
    return null;
  };

  try {
    const direct = asObject(JSON.parse(t));
    if (direct) return direct;
  } catch {
    /* slice the first JSON value out of the surrounding prose */
  }

  const starts = [t.indexOf("{"), t.indexOf("[")].filter((n) => n >= 0);
  if (!starts.length) return null;
  const s = Math.min(...starts);
  const e = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (e < s) return null;
  try {
    return asObject(JSON.parse(t.slice(s, e + 1)));
  } catch {
    return null;
  }
}

export function previewKindFor(taskType: string, body: string): PreviewKind {
  if (taskType === "improve_content") return "audit";
  if (taskType === "fix_meta") return "meta";
  const json = parseJsonObject(body);
  if (json && Array.isArray(json.titles) && Array.isArray(json.metas)) return "meta";
  if (json && Array.isArray(json.checks)) return "audit";
  return "page";
}

export function displayWorkTitle(title: string): string {
  const stripped = title
    .replace(/^(Blog|Page|New blog|New page|Audit \+ rewrite|Meta rewrite|Intent fix):\s*/i, "")
    .trim() || title;
  try {
    const path = new URL(stripped).pathname.replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).pop();
    return last ? last.replace(/-/g, " ") : stripped;
  } catch {
    return stripped;
  }
}

export type MetaPreview = { titles: string[]; metas: string[]; why: string | null };

export function metaFromBody(body: string): MetaPreview | null {
  const json = parseJsonObject(body);
  if (!json) return null;
  const titles = Array.isArray(json.titles) ? json.titles.filter((t): t is string => typeof t === "string") : [];
  const metas = Array.isArray(json.metas) ? json.metas.filter((t): t is string => typeof t === "string") : [];
  if (!titles.length && !metas.length) return null;
  const why = typeof json.why === "string" ? json.why : null;
  return { titles, metas, why };
}

export type PagePreview = { title: string; meta: string; markdown: string };

export function pageFromBody(body: string, fallbackTitle: string): PagePreview {
  const { title, meta, body: markdown } = splitFrontMatter(unwrapDraftBody(body), fallbackTitle);
  return { title: title || stripDraftPrefix(fallbackTitle), meta, markdown };
}

export function firstMarkdownImage(markdown: string): { src: string; alt: string } | null {
  // http(s) or a site-relative path. javascript:/data: never match.
  const m = markdown.match(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/(?!\/)[^)\s]+)\)/i);
  if (!m) return null;
  return { alt: m[1], src: m[2] };
}

/** Turn a preview image src into an absolute URL when the draft used a site-relative path. */
export function resolvePreviewSrc(src: string, siteUrl?: string | null): string {
  if (!src.startsWith("/") || src.startsWith("//") || !siteUrl) return src;
  try {
    return new URL(src, siteUrl).href;
  } catch {
    return src;
  }
}

/** So the page preview can load photos the draft stored as `/uploads/...`. */
export function absolutizeMarkdownImages(markdown: string, siteUrl?: string | null): string {
  if (!siteUrl) return markdown;
  return markdown.replace(/!\[([^\]]*)\]\((\/(?!\/)[^)\s]+)\)/g, (_m, alt: string, src: string) => {
    return `![${alt}](${resolvePreviewSrc(src, siteUrl)})`;
  });
}

/** Plain post text with image markdown removed, so the GBP card does not show leftover `![]()`. */
export function postTextWithoutImages(body: string): string {
  return unwrapDraftBody(body)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function siteOrigin(siteUrl?: string | null): string | null {
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return siteUrl.replace(/\/+$/, "") || null;
  }
}

/**
 * The address this work will live at (or the page it will change).
 * Matches the slug rules in the approve path, so the card never promises a
 * different URL than the one that actually publishes.
 */
export function plannedPageUrl(opts: {
  taskType: string;
  title: string;
  targetUrl?: string | null;
  targetKeyword?: string | null;
  siteUrl?: string | null;
}): string | null {
  if (opts.targetUrl) {
    try { return new URL(opts.targetUrl).href; } catch {
      const origin = siteOrigin(opts.siteUrl);
      if (opts.targetUrl.startsWith("/") && origin) return `${origin}${opts.targetUrl}`;
      return opts.targetUrl;
    }
  }
  const origin = siteOrigin(opts.siteUrl);
  if (!origin) return null;
  if (opts.taskType === "geo_answers") return `${origin}/faq`;
  if (opts.taskType !== "new_page" && opts.taskType !== "new_blog") return null;
  const raw = opts.targetKeyword || opts.title.replace(/^(Blog|Page|New blog|New page):\s*/i, "");
  const base = slugify(raw);
  if (!base) return null;
  return opts.taskType === "new_blog" ? `${origin}/blog/${base}` : `${origin}/${base}`;
}

export type RewriteStep = { n: number; title: string; detail: string };
export type RewritePlan = { intro: string; steps: RewriteStep[] };

type AuditCheck = { item?: unknown; status?: unknown; fix?: unknown; problem?: unknown; severity?: unknown };

const ITEM_TITLE: Record<string, string> = {
  "title tag": "Write a clear title for Google",
  "title": "Write a clear title for Google",
  "meta description": "Write the short line under the title in Google",
  "meta": "Write the short line under the title in Google",
  "h1": "Give the page one main heading",
  "headings": "Make the headings easier to follow",
  "keyword usage": "Use the search words people actually type",
  "word count": "Add more useful content",
  "internal links": "Link this page to other pages on the site",
  "images": "Add photos so the page is easier to understand",
  "cta": "Add a clear next step, like calling or booking",
  "faq": "Add short answers to the questions people ask",
  "faq/answer-content for ai assistants": "Add short answers to the questions people ask",
  "readability": "Make the writing easier to read",
  "schema": "Add the extra details Google uses to understand this business",
};

function normItem(item: string): string {
  return item.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function customerItem(item: string): string {
  const key = normItem(item);
  if (ITEM_TITLE[key]) return ITEM_TITLE[key];
  if (/\btitle\b/.test(key)) return ITEM_TITLE["title tag"];
  if (/\bmeta\b/.test(key)) return ITEM_TITLE["meta description"];
  if (/\bh1\b/.test(key) || /\bheading\b/.test(key)) return ITEM_TITLE.h1;
  if (/\bschema\b/.test(key)) return ITEM_TITLE.schema;
  if (/\bfaq\b/.test(key) || /\bassistant\b/.test(key)) return ITEM_TITLE.faq;
  if (/\bcta\b/.test(key) || /call to action/.test(key)) return ITEM_TITLE.cta;
  if (/\blink\b/.test(key)) return ITEM_TITLE["internal links"];
  if (/\bimage\b/.test(key) || /\bphoto\b/.test(key)) return ITEM_TITLE.images;
  return item.replace(/_/g, " ");
}

function customerFix(fix: string): string {
  return fix
    .replace(/\bthe paid-intent keyword\b/gi, "the words people search when they are ready to book")
    .replace(/\bpaid-intent keyword\b/gi, "the words people search when they are ready to book")
    .replace(/\bpaid-intent\b/gi, "booking")
    .replace(/\btitle tag\b/gi, "Google title")
    .replace(/\bmeta description\b/gi, "Google description")
    .replace(/\bschema\.org\b/gi, "the extra details Google reads")
    .replace(/\bH1\b/g, "main heading")
    .replace(/\bCTA\b/g, "call to action")
    .replace(/\bE-E-A-T\b/g, "trust")
    .replace(/\bthe the\b/g, "the")
    .trim();
}

function checksFromJson(json: Record<string, unknown> | null): AuditCheck[] {
  if (!json) return [];
  if (Array.isArray(json.checks)) return json.checks as AuditCheck[];
  if (Array.isArray(json.issues)) {
    return (json.issues as AuditCheck[]).map((issue) => ({
      item: issue.item || issue.problem,
      status: issue.status || (issue.severity === "low" ? "warn" : "fail"),
      fix: issue.fix,
    }));
  }
  return [];
}

function looksLikeJsonBlob(text: string): boolean {
  const t = unwrapDraftBody(text);
  return /^\s*[{\[]/.test(t) || /"(checks|score|issues)"\s*:/.test(t);
}

function planFromProse(body: string): RewriteStep[] {
  if (looksLikeJsonBlob(body)) return [];
  const lines = unwrapDraftBody(body)
    .split(/\n+/)
    .map((line) => line.replace(/^[-*#>\d.)]+\s*/, "").replace(/\*\*/g, "").trim())
    .filter((line) => line.length > 20 && !line.startsWith("{") && !/^return only json/i.test(line));
  return lines.slice(0, 8).map((line, i) => ({
    n: i + 1,
    title: line.length > 72 ? `${line.slice(0, 68).trim()}…` : line,
    detail: line.length > 72 ? line : "We will make this change on the page.",
  }));
}

function stepsFromChecks(checks: AuditCheck[]): RewriteStep[] {
  return checks.map((c, i) => ({
    n: i + 1,
    title: customerItem(typeof c.item === "string" ? c.item : "Fix this"),
    detail: customerFix(typeof c.fix === "string" ? c.fix : "We will update this on the page."),
  }));
}

/** Numbered, plain-language plan for a rewrite/audit. Never dumps JSON. */
export function rewritePlanFromBody(
  body: string,
  opts?: { keyword?: string | null; url?: string | null }
): RewritePlan {
  const json = parseJsonObject(body);
  const checks = checksFromJson(json);
  const work = checks.filter((c) => String(c.status || "").toLowerCase() !== "pass");
  const source = work.length ? work : checks;
  const where = opts?.url ? "this page" : "the page";
  const kw = opts?.keyword?.trim();

  if (source.length) {
    const intro = work.length
      ? `Here is what we will change on ${where}${kw ? `, aimed at people searching for “${kw}”` : ""}. Approving this files the plan — it does not rewrite the live page by itself.`
      : `We checked ${where} and did not find changes worth making right now.`;
    return { intro, steps: stepsFromChecks(source) };
  }

  const prose = planFromProse(body);
  if (prose.length) {
    return {
      intro: `Here is what we will change on ${where}${kw ? `, aimed at people searching for “${kw}”` : ""}. Approving this files the plan — it does not rewrite the live page by itself.`,
      steps: prose,
    };
  }

  return {
    intro: `We looked at ${where}${kw ? ` for “${kw}”` : ""} and could not turn the review into a readable plan.`,
    steps: [{
      n: 1,
      title: "Send this back",
      detail: "Decline it, or tell the agent to rewrite the plan in plain language. Approving it will not change the live page.",
    }],
  };
}

export type KeywordFacts = {
  volume?: number | null;
  position?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  intent?: string | null;
  opportunity?: string | null;
  source?: string | null;
};

export type DecisionWhyInput = {
  kind: "draft" | "google_post" | "backlink";
  taskType?: string | null;
  title?: string | null;
  keyword?: string | null;
  url?: string | null;
  rationale?: string | null;
  body?: string | null;
  facts?: KeywordFacts | null;
};

const BOILERPLATE_WHY: Record<string, string> = {
  "search-intent qualification.":
    "This search is bringing the wrong visitors. The page should speak to people who are ready to book, not people looking for a free option.",
};

function cleanRationale(text: string, facts?: KeywordFacts | null): string {
  let t = text.trim();
  if (!t) return "";
  const mapped = BOILERPLATE_WHY[t.toLowerCase()];
  if (mapped) return mapped;
  t = t.replace(
    /\s*\(redirected from new page — topic already exists\)/i,
    ""
  ).trim();
  const redirected = /redirected from new page/i.test(text);
  t = customerFix(t);
  const hasVolume = facts?.volume != null && facts.volume > 0;
  if (!hasVolume) {
    t = t.replace(/\bno baseline data exists yet,?\s*/gi, "");
    t = t.replace(/\s*with real search volume\b/gi, "");
    t = t.replace(/\band this is a core high-intent commercial query\.?/gi, "");
    t = t.replace(/\s{2,}/g, " ").replace(/^\s*and\s+/i, "").replace(/^,\s*/, "").replace(/\s+\./g, ".").trim();
  }
  if (redirected && t) {
    return `${t} A page on this topic already exists, so this is a rewrite of that URL instead of a second page.`;
  }
  if (redirected) {
    return "A page on this topic already exists, so this is a rewrite of that URL instead of a second page.";
  }
  return t;
}

export type TechnicalFinding = { title: string; detail: string };

function problemLabel(itemTitle: string): string {
  return itemTitle
    .replace(/^Write a clear title for Google$/i, "Google title is missing or weak")
    .replace(/^Write the short line under the title in Google$/i, "Google description is missing or weak")
    .replace(/^Give the page one main heading$/i, "Main heading needs work")
    .replace(/^Use the search words people actually type$/i, "The page barely uses the words people search")
    .replace(/^Add more useful content$/i, "The page is too thin")
    .replace(/^Link this page to other pages on the site$/i, "Not linked from the rest of the site")
    .replace(/^Add photos so the page is easier to understand$/i, "Needs photos")
    .replace(/^Add a clear next step, like calling or booking$/i, "No clear next step")
    .replace(/^Add short answers to the questions people ask$/i, "Does not answer the questions people ask")
    .replace(/^Make the writing easier to read$/i, "Writing is hard to follow")
    .replace(/^Add the extra details Google uses to understand this business$/i, "Missing the extra details Google uses to understand the page")
    .replace(/^Make the headings easier to follow$/i, "Headings are hard to follow");
}

function technicalFindings(body?: string | null): TechnicalFinding[] {
  const checks = checksFromJson(parseJsonObject(body || ""));
  const work = checks.filter((c) => String(c.status || "").toLowerCase() !== "pass");
  return work.map((c) => {
    const title = problemLabel(customerItem(typeof c.item === "string" ? c.item : "Fix this"));
    const detail = customerFix(
      typeof c.fix === "string" && c.fix.trim()
        ? c.fix
        : typeof c.problem === "string" ? c.problem : ""
    );
    return { title, detail };
  }).filter((f) => f.title);
}

function auditScore(body?: string | null): number | null {
  const json = parseJsonObject(body || "");
  const score = json && typeof json.score === "number" ? json.score : null;
  return score != null && Number.isFinite(score) ? score : null;
}

function quotedKeyword(keyword?: string | null): string {
  const kw = keyword?.trim();
  return kw ? `“${kw}”` : "";
}

/** Only facts that are actually stored. Missing numbers are omitted, not mentioned. */
function measuredLines(facts: KeywordFacts | null | undefined, quoted: string): string[] {
  if (!facts) return [];
  const lines: string[] = [];
  if (facts.volume != null && facts.volume > 0) {
    lines.push(`Monthly search volume${quoted ? ` for ${quoted}` : ""}: ${facts.volume.toLocaleString()}.`);
  }
  if (facts.position != null && Number(facts.position) > 0) {
    lines.push(`Saved ranking: position ${Number(facts.position)}.`);
  }
  if (facts.impressions != null && facts.impressions > 0) {
    lines.push(`Search Console impressions (latest capture): ${facts.impressions.toLocaleString()}.`);
  }
  if (facts.clicks != null && facts.clicks > 0) {
    lines.push(`Search Console clicks (latest capture): ${facts.clicks.toLocaleString()}.`);
  }
  if (facts.intent) lines.push(`Search intent: ${facts.intent}.`);
  if (facts.opportunity) lines.push(customerFix(facts.opportunity));
  return lines;
}

function draftHeadings(body: string, fallbackTitle: string): string[] {
  if (previewKindFor("new_page", body) !== "page") return [];
  const page = pageFromBody(body, fallbackTitle);
  const heads = [...page.markdown.matchAll(/^#{1,3}\s+(.+)$/gm)]
    .map((m) => m[1].replace(/\*\*/g, "").trim())
    .filter(Boolean);
  return [...new Set(heads)].slice(0, 16);
}

function numbered(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

function decisionLine(input: DecisionWhyInput): string {
  const quoted = quotedKeyword(input.keyword);
  const url = input.url?.trim() || "";
  const title = displayWorkTitle(input.title || "");
  const type = input.taskType || "";

  if (input.kind === "google_post") {
    return title
      ? `Publish a Google Business Profile post: ${title}.`
      : "Publish a Google Business Profile post.";
  }
  if (input.kind === "backlink") {
    return title ? `Pursue a listing on ${title}.` : "Pursue this listing.";
  }
  if (type === "new_page") {
    return quoted
      ? `Add a new service page targeting ${quoted}.`
      : "Add a new service page for this offer.";
  }
  if (type === "new_blog") {
    return quoted
      ? `Add a new blog post targeting ${quoted}.`
      : "Add a new blog post for this topic.";
  }
  if (type === "improve_content") {
    const target = url || title || "this page";
    return quoted
      ? `Rewrite ${target} for ${quoted}.`
      : `Rewrite ${target}.`;
  }
  if (type === "fix_meta") {
    const target = url || title || "this page";
    return quoted
      ? `Change the Google title and description for ${target} so it matches ${quoted}.`
      : `Change the Google title and description for ${target}.`;
  }
  if (type === "geo_answers") {
    return quoted
      ? `Add FAQ / AI-answer content for ${quoted}.`
      : "Add FAQ / AI-answer content for the questions people ask about this service.";
  }
  return quoted ? `Queue this work for ${quoted}.` : "Queue this work.";
}

function logicParagraphs(input: DecisionWhyInput): string[] {
  const quoted = quotedKeyword(input.keyword);
  const rationale = cleanRationale(input.rationale || "", input.facts);
  const type = input.taskType || "";
  const findings = technicalFindings(input.body);
  const measured = measuredLines(input.facts, quoted);
  const bits: string[] = [];

  if (input.kind === "google_post") {
    bits.push("Google Business Profile treats a fresh post as a local freshness signal in Maps and local search. This is the regular posting cadence for the listing.");
    return bits;
  }

  if (input.kind === "backlink") {
    if (rationale) bits.push(rationale);
    bits.push("An editorial listing on another site is an off-site trust signal. Google uses those as evidence the business is real and cited locally.");
    return bits;
  }

  if (type === "new_page") {
    bits.push(
      quoted
        ? `There is no service page targeting ${quoted}. Google ranks a dedicated URL for a query like this, so the recommendation is to publish one rather than hoping a general page covers it.`
        : "There is no service page covering this offer, so the recommendation is to publish a dedicated URL."
    );
  } else if (type === "new_blog") {
    bits.push(
      quoted
        ? `There is no article targeting ${quoted}. A focused post is how that query gets a URL Google and AI assistants can cite.`
        : "There is no article covering this topic, so the recommendation is to publish one."
    );
  } else if (type === "improve_content") {
    const score = auditScore(input.body);
    const scoreBit = score != null ? ` Audit score: ${score}/100.` : "";
    if (findings.length) {
      bits.push(`The live page fails these checks, which is why a rewrite is queued instead of leaving it as-is.${scoreBit}`);
    } else {
      bits.push(`The live page is not winning this query, so a rewrite plan is queued.${scoreBit}`.trim());
    }
  } else if (type === "fix_meta") {
    const metaWhy = metaFromBody(input.body || "")?.why;
    bits.push(
      quoted
        ? `The current Google listing for this URL does not make it obvious that the page answers ${quoted}. Title and description are what searchers see before they click.`
        : "The current Google listing for this URL is not doing the job. Title and description are what searchers see before they click."
    );
    if (metaWhy) bits.push(customerFix(metaWhy));
  } else if (type === "geo_answers") {
    bits.push(
      quoted
        ? `Assistants and “People also ask” boxes quote short, direct answers. There is no FAQ block aimed at ${quoted}, so one is queued.`
        : "Assistants and “People also ask” boxes quote short, direct answers. This queues a FAQ block they can cite."
    );
  }

  if (measured.length) bits.push(measured.join(" "));
  if (rationale && rationale !== bits[bits.length - 1]) bits.push(rationale);

  if (type === "improve_content" && findings.length) {
    bits.push(findings.map((f) => f.detail ? `${f.title}. ${f.detail}` : f.title).join("\n"));
  }

  if (type === "improve_content") {
    bits.push("Approving this files the plan. It does not rewrite the live page by itself.");
  }

  return bits.filter(Boolean);
}

/**
 * Why this recommendation was queued: the decision, then the technical
 * reasons that actually exist. Never invents volume, ranks, or competitors.
 * Does not mention missing data.
 */
export function decisionWhy(input: DecisionWhyInput): string {
  return [decisionLine(input), ...logicParagraphs(input)].join("\n\n");
}

export type DecisionSection = { heading: string; body: string };

function pushSection(sections: DecisionSection[], heading: string, body: string | null | undefined) {
  const text = (body || "").trim();
  if (!text) return;
  sections.push({ heading, body: text });
}

/** Full decision report: every stored reason, finding, and suggested change. Skip anything we do not have. */
export function buildDecisionReport(input: DecisionWhyInput): { title: string; sections: DecisionSection[] } {
  const keyword = input.keyword?.trim() || displayWorkTitle(input.title || "this work");
  const quoted = quotedKeyword(input.keyword);
  const rationale = cleanRationale(input.rationale || "", input.facts);
  const findings = technicalFindings(input.body);
  const measured = measuredLines(input.facts, quoted);
  const type = input.taskType || "";
  const sections: DecisionSection[] = [];

  pushSection(sections, "The decision", decisionLine(input));
  const whyBits = logicParagraphs(input).filter((p) => {
    if (measured.length && p === measured.join(" ")) return false;
    if (type === "improve_content" && findings.length && p === findings.map((f) => f.detail ? `${f.title}. ${f.detail}` : f.title).join("\n")) {
      return false;
    }
    return true;
  });
  pushSection(sections, "Why", whyBits.join("\n\n"));

  if (measured.length) {
    pushSection(sections, "Signals used", numbered(measured));
  }

  const score = auditScore(input.body);
  if (findings.length) {
    const head = score != null ? `Audit score: ${score}/100.\n\n` : "";
    pushSection(
      sections,
      "Technical problems",
      head + numbered(findings.map((f) => f.detail ? `${f.title}. ${f.detail}` : f.title))
    );
  }

  if (type === "improve_content" && input.body) {
    const plan = rewritePlanFromBody(input.body, { keyword: input.keyword, url: input.url });
    if (plan.steps.length && !/send this back/i.test(plan.steps[0].title)) {
      pushSection(
        sections,
        "Recommended changes",
        plan.steps.map((s) => `${s.n}. ${s.title}. ${s.detail}`).join("\n")
      );
    }
  }

  const meta = metaFromBody(input.body || "");
  if (meta && (meta.titles.length || meta.metas.length)) {
    const parts: string[] = [];
    if (meta.why) parts.push(customerFix(meta.why));
    if (meta.titles.length) parts.push(`Title options:\n${numbered(meta.titles)}`);
    if (meta.metas.length) parts.push(`Description options:\n${numbered(meta.metas)}`);
    pushSection(sections, "Proposed search listing", parts.join("\n\n"));
  }

  if ((type === "new_page" || type === "new_blog") && input.body) {
    const page = pageFromBody(input.body, input.title || keyword);
    const outline = draftHeadings(input.body, input.title || keyword);
    const parts: string[] = [];
    if (page.title) parts.push(`Draft Google title: ${page.title}`);
    if (page.meta) parts.push(`Draft Google description: ${page.meta}`);
    if (outline.length) parts.push(`Sections in the draft:\n${numbered(outline)}`);
    pushSection(sections, "What the draft covers", parts.join("\n\n"));
  }

  if (rationale && !sections.some((s) => s.body.includes(rationale))) {
    pushSection(sections, "Planner reason", rationale);
  }

  if (!sections.length) {
    pushSection(sections, "The decision", decisionLine(input));
  }

  return { title: keyword, sections };
}
