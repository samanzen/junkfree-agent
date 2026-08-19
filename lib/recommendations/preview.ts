// What a recommendation *looks like* when a person opens Preview.
//
// The queue itself only shows a title. This module turns the stored draft
// body into the three shapes a preview can honestly render: a page (markdown,
// including images), a Google search result (meta options), or a Google
// Business Profile post. Pure, so the overlay and the tests share one parser.

import { splitFrontMatter, stripDraftPrefix } from "../utils";

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
  if (taskType === "fix_meta") return "meta";
  const json = parseJsonObject(body);
  if (json && Array.isArray(json.titles) && Array.isArray(json.metas)) return "meta";
  if (json && Array.isArray(json.checks)) return "audit";
  return "page";
}

export function displayWorkTitle(title: string): string {
  return title
    .replace(/^(Blog|Page|New blog|New page|Audit \+ rewrite|Meta rewrite|Intent fix):\s*/i, "")
    .trim() || title;
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

/** One-line queue copy. The list never dumps the draft — Preview is the way in. */
export function queueHintFor(
  taskType: string,
  opts?: { body?: string; brandName?: string }
): string {
  const kind = taskType === "google_post"
    ? "google_post"
    : previewKindFor(taskType, opts?.body || "");
  if (kind === "google_post") {
    return `Open Preview to see this as a Google post for ${opts?.brandName || "this brand"}.`;
  }
  if (kind === "meta") {
    return "Open Preview to see how this will look as a Google search result.";
  }
  if (kind === "audit") {
    return "Open Preview to read the audit before anything goes live.";
  }
  return "Open Preview to see the actual page, including any images.";
}
