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

const BOILERPLATE_WHY: Record<string, string> = {
  "search-intent qualification.":
    "This search is bringing the wrong visitors. The page should speak to people who are ready to book, not people looking for a free option.",
};

function cleanRationale(text: string): string {
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
  if (redirected && t) {
    return `${t} You already have a page on this topic, so I am improving that page instead of creating a new one.`;
  }
  if (redirected) {
    return "You already have a page on this topic, so I am improving that page instead of creating a new one.";
  }
  return t;
}

function failedFindings(body?: string | null): string[] {
  const checks = checksFromJson(parseJsonObject(body || ""));
  const work = checks.filter((c) => String(c.status || "").toLowerCase() !== "pass");
  const source = work.length ? work : [];
  const labels = source
    .map((c) => (typeof c.item === "string" ? customerItem(c.item) : ""))
    .map((label) => label.replace(/^Write a clear title for Google$/i, "the Google title is missing or weak")
      .replace(/^Write the short line under the title in Google$/i, "the short Google description is missing or weak")
      .replace(/^Give the page one main heading$/i, "the main heading needs work")
      .replace(/^Use the search words people actually type$/i, "the page barely uses the words people search")
      .replace(/^Add more useful content$/i, "the page is too thin")
      .replace(/^Link this page to other pages on the site$/i, "it is not linked from the rest of the site")
      .replace(/^Add photos so the page is easier to understand$/i, "it needs photos")
      .replace(/^Add a clear next step, like calling or booking$/i, "there is no clear next step")
      .replace(/^Add short answers to the questions people ask$/i, "it does not answer the questions people ask")
      .replace(/^Make the writing easier to read$/i, "the writing is hard to follow")
      .replace(/^Add the extra details Google uses to understand this business$/i, "Google does not have the extra details it needs to understand the page")
      .replace(/^Make the headings easier to follow$/i, "the headings are hard to follow"))
    .filter(Boolean);
  return [...new Set(labels)].slice(0, 6);
}

function joinFindings(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]}, and ${items[1]}`;
  return `${items.slice(0, -1).join("; ")}; and ${items[items.length - 1]}`;
}

export type DecisionWhyInput = {
  kind: "draft" | "google_post" | "backlink";
  taskType?: string | null;
  title?: string | null;
  keyword?: string | null;
  url?: string | null;
  rationale?: string | null;
  body?: string | null;
};

/**
 * Agent-voice explanation of why this work is in the queue.
 * Built from the stored rationale, the keyword/URL, and (for rewrites) the
 * actual audit findings. Never invents competitor names or ranks.
 */
export function decisionWhy(input: DecisionWhyInput): string {
  const keyword = input.keyword?.trim() || "";
  const url = input.url?.trim() || "";
  const rationale = cleanRationale(input.rationale || "");
  const type = input.taskType || "";
  const findings = failedFindings(input.body);
  const quoted = keyword ? `“${keyword}”` : "";

  if (input.kind === "google_post") {
    return [
      "I drafted this Google post to keep your Business Profile active this week.",
      "A fresh post helps the listing show up in Maps and local search when people nearby are looking for this service.",
      "There is no separate research note for this one — it is part of the regular local cadence.",
    ].join("\n\n");
  }

  if (input.kind === "backlink") {
    const name = input.title?.trim() ? `“${input.title.trim()}”` : "this site";
    const bits = [`I flagged ${name} as a listing worth going after.`];
    if (rationale) bits.push(rationale);
    bits.push("A listing here is a vote of trust from another site, which helps Google treat you as a real local business.");
    return bits.join("\n\n");
  }

  if (type === "improve_content") {
    const opened = url
      ? `I opened ${url}${quoted ? ` and reviewed it for people searching ${quoted}` : ""}.`
      : `I reviewed this page${quoted ? ` for people searching ${quoted}` : ""}.`;
    const bits = [opened];
    if (findings.length) {
      bits.push(`Here is what I found: ${joinFindings(findings)}. That is why I queued this rewrite instead of leaving the page as-is.`);
    } else if (rationale) {
      bits.push(rationale);
    } else {
      bits.push("The page is not doing enough to win that search, so I queued a plan of changes.");
    }
    if (rationale && findings.length && rationale !== bits[1]) bits.push(rationale);
    bits.push("Approving this files the plan. It does not rewrite the live page by itself.");
    return bits.join("\n\n");
  }

  if (type === "new_blog") {
    const bits = [
      quoted
        ? `I looked at the searches you could rank for and picked ${quoted}. You do not have a blog post aimed at that search yet, so I drafted one.`
        : "I drafted this blog post because you do not have an article covering this topic yet.",
    ];
    if (rationale) bits.push(rationale);
    bits.push("A focused article gives Google — and AI assistants — something to show when people ask about this.");
    return bits.join("\n\n");
  }

  if (type === "new_page") {
    const bits = [
      quoted
        ? `People search ${quoted} when they are ready to hire this kind of service, and you do not have a page aimed at that search yet. I drafted one.`
        : "I drafted this service page because you do not have a page covering this offer yet.",
    ];
    if (rationale) bits.push(rationale);
    bits.push("A dedicated page is what Google ranks for that search, and it is the page we can send paid traffic to later.");
    return bits.join("\n\n");
  }

  if (type === "fix_meta") {
    const bits = [
      url
        ? `I looked at how ${url} appears in Google.`
        : "I looked at how this page appears in Google.",
    ];
    if (quoted) {
      bits.push(`People searching ${quoted} should understand from the title and the short line under it that you can help. Right now that listing is not doing the job.`);
    }
    const metaWhy = metaFromBody(input.body || "")?.why;
    if (metaWhy) bits.push(customerFix(metaWhy));
    else if (rationale) bits.push(rationale);
    bits.push("I wrote new title and description options so the search listing matches what those people want.");
    return bits.join("\n\n");
  }

  if (type === "geo_answers") {
    const bits = [
      quoted
        ? `People — and AI assistants — ask ${quoted}. I drafted short, direct answers so those questions can point back to you.`
        : "I drafted short answers to the questions people ask about this service, so Google and AI assistants have something clear to quote.",
    ];
    if (rationale) bits.push(rationale);
    return bits.join("\n\n");
  }

  const bits: string[] = [];
  if (quoted) bits.push(`I queued this for people searching ${quoted}.`);
  if (rationale) bits.push(rationale);
  if (!bits.length) bits.push("I queued this because it is the next highest-impact change for the site.");
  return bits.join("\n\n");
}
