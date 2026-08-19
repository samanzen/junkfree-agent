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

export function parseJsonObject(body: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(unwrapDraftBody(body));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
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

function customerItem(item: string): string {
  const key = item.trim().toLowerCase();
  return ITEM_TITLE[key] || item.replace(/_/g, " ");
}

function customerFix(fix: string): string {
  return fix
    .replace(/\bpaid-intent keyword\b/gi, "the words people search when they are ready to book")
    .replace(/\btitle tag\b/gi, "Google title")
    .replace(/\bmeta description\b/gi, "Google description")
    .replace(/\bschema\.org\b/gi, "the extra details Google reads")
    .replace(/\bH1\b/g, "main heading")
    .replace(/\bCTA\b/g, "call to action")
    .replace(/\bE-E-A-T\b/g, "trust")
    .trim();
}

/** Numbered, plain-language plan for a rewrite/audit. Never dumps JSON. */
export function rewritePlanFromBody(
  body: string,
  opts?: { keyword?: string | null; url?: string | null }
): RewritePlan {
  const json = parseJsonObject(body);
  const checks = Array.isArray(json?.checks)
    ? (json!.checks as { item?: unknown; status?: unknown; fix?: unknown }[])
    : [];
  const work = checks.filter((c) => c.status !== "pass");
  const source = work.length ? work : checks;
  const where = opts?.url ? "this page" : "the page";
  const kw = opts?.keyword?.trim();

  if (!source.length) {
    return {
      intro: `We looked at ${where}${kw ? ` for “${kw}”` : ""} and could not turn the review into a readable plan.`,
      steps: [{
        n: 1,
        title: "Send this back",
        detail: "Decline it, or tell the agent to rewrite the plan in plain language. Approving it will not change the live page.",
      }],
    };
  }

  const steps: RewriteStep[] = source.map((c, i) => ({
    n: i + 1,
    title: customerItem(typeof c.item === "string" ? c.item : "Fix this"),
    detail: customerFix(typeof c.fix === "string" ? c.fix : "We will update this on the page."),
  }));

  const intro = work.length
    ? `Here is what we will change on ${where}${kw ? `, aimed at people searching for “${kw}”` : ""}. Approving this files the plan — it does not rewrite the live page by itself.`
    : `We checked ${where} and did not find changes worth making right now.`;

  return { intro, steps };
}

const BOILERPLATE_WHY: Record<string, string> = {
  "search-intent qualification.":
    "This search is bringing the wrong visitors. We queued a change so the page speaks to people who are ready to book.",
};

export function decisionWhy(
  kind: "draft" | "google_post" | "backlink",
  rationale?: string | null
): string | null {
  let text = (rationale || "").trim();
  if (text) {
    const mapped = BOILERPLATE_WHY[text.toLowerCase()];
    if (mapped) return mapped;
    text = text.replace(
      /\(redirected from new page — topic already exists\)/i,
      "We already have a page on this topic, so this improves that page instead of creating a new one."
    );
    return text;
  }
  if (kind === "google_post") {
    return "Agents write a Google post so the Business Profile stays active. A fresh post helps the listing show up in Maps.";
  }
  return null;
}
