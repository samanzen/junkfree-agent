// DRAFT -> SITE CHANGE translation. The one place that decides whether a draft
// is actually publishable, and what it means in platform-neutral terms.
//
// This exists because the content pipeline produces four genuinely different
// artifacts and only some of them are page content:
//
//   new_page / new_blog  markdown + "TITLE TAG:"/"META:" front matter  -> publishable
//   geo_answers          markdown FAQ                                  -> publishable
//   fix_meta             JSON {titles:[3], metas:[3]} -- OPTIONS, not a
//                        decision, so it needs a chosen index first
//   improve_content      JSON {score, checks[]} -- an AUDIT REPORT. It is not
//                        page content and must never be written to a live site.
//
// Refusing loudly here is the point: the alternative is an adapter cheerfully
// publishing a JSON audit blob as a customer's landing page.
//
// Slug and title derivation mirror app/api/drafts/[id]/approve/route.ts exactly
// and reuse the same lib/utils helpers, so the engine and the existing approve
// path can never disagree about where a draft belongs.

import { slugify, splitFrontMatter } from "../utils";
import type { SiteChange } from "./types";

export type DraftLike = {
  task_type: string;
  title: string;
  body: string;
  target_url: string | null;
  target_keyword: string | null;
};

export type TranslationResult =
  | { publishable: true; change: SiteChange }
  | { publishable: false; reason: string };

/** Options a draft offers but has not chosen between. */
type MetaOptions = { titles?: unknown; metas?: unknown };

function parseJsonBody(body: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(body.trim());
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function firstString(v: unknown, index: number): string | null {
  if (!Array.isArray(v)) return null;
  const picked = v[index];
  return typeof picked === "string" && picked.trim() ? picked.trim() : null;
}

/**
 * Translate one draft into a change an adapter can apply.
 *
 * `metaChoice` selects which of a fix_meta draft's generated options to apply.
 * It is required rather than defaulted to 0 on purpose: the model produces
 * three titles and three descriptions precisely because a human is meant to
 * pick, and silently taking the first would turn a choice into an accident.
 */
export function toSiteChange(
  draft: DraftLike,
  brandName: string,
  metaChoice?: number
): TranslationResult {
  const type = draft.task_type;

  if (type === "improve_content") {
    return {
      publishable: false,
      reason:
        "improve_content drafts contain an audit report (score + checks), not page content. " +
        "There is nothing here that could be written to a live page.",
    };
  }

  if (type === "fix_meta") {
    if (!draft.target_url) {
      return { publishable: false, reason: "fix_meta draft has no target_url, so there is no page to update." };
    }
    const parsed = parseJsonBody(draft.body) as MetaOptions | null;
    if (!parsed) {
      return {
        publishable: false,
        reason: draft.body.trim()
          ? "fix_meta body is not valid JSON, so no title/description options could be read from it."
          : "fix_meta draft has an empty body -- the generation produced nothing to apply.",
      };
    }
    if (metaChoice == null) {
      const count = Array.isArray(parsed.titles) ? parsed.titles.length : 0;
      return {
        publishable: false,
        reason: `fix_meta produced ${count} title/description option(s). Choose one (metaChoice) before publishing -- the engine will not pick for you.`,
      };
    }
    const title = firstString(parsed.titles, metaChoice);
    const metaDescription = firstString(parsed.metas, metaChoice);
    if (!title && !metaDescription) {
      return { publishable: false, reason: `Option ${metaChoice} does not exist in this draft's title/description list.` };
    }
    return {
      publishable: true,
      change: { type: "update_meta", url: draft.target_url, title, metaDescription },
    };
  }

  if (type === "new_page" || type === "new_blog" || type === "geo_answers") {
    const { title, meta, body } = splitFrontMatter(draft.body, draft.title);
    if (!body.trim()) {
      return { publishable: false, reason: "Draft body is empty once front matter is removed -- nothing to publish." };
    }

    // Identical derivation to the approve route, so both paths agree on slugs.
    const raw = draft.target_keyword || draft.title.replace(/^(Blog|Page):\s*/i, "");
    const base = slugify(raw);
    if (!base && type !== "geo_answers") {
      return { publishable: false, reason: "Could not derive a slug from this draft's keyword or title." };
    }
    const slug = type === "geo_answers" ? "faq" : type === "new_page" ? base : `blog/${base}`;
    const finalTitle =
      type === "geo_answers" ? `Frequently Asked Questions — ${brandName}` : title;

    return {
      publishable: true,
      change: {
        type: "upsert_page",
        slug,
        title: finalTitle,
        metaDescription: meta || null,
        bodyMarkdown: body,
      },
    };
  }

  return { publishable: false, reason: `Task type "${type}" has no defined site change.` };
}
