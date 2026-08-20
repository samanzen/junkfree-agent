// Publish checker — staff under the Manager.
// After a publish, re-fetch the live URL and confirm the new page is actually
// there. Adapter "ok" is not enough.

import { inspectPage } from "../auditor";
import { canUse } from "../capabilities";
import { recordActivity } from "../agents/store";
import type { Brand } from "../brands";
import { db } from "../supabase";

export type PublishExpectation = {
  url: string;
  changeType: "upsert_page" | "update_meta" | string;
  title?: string | null;
  keyword?: string | null;
  bodySnippet?: string | null;
};

export type PublishCheckResult = {
  ok: boolean;
  url: string;
  reason: string;
  liveTitle: string | null;
  liveWords: number;
};

const TITLE_MIN = 5;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function snippetOf(body: string | null | undefined): string {
  if (!body) return "";
  return body
    .replace(/^TITLE TAG:.*$/im, "")
    .replace(/^META:.*$/im, "")
    .replace(/[#*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function expectedSnippet(body?: string | null): string | null {
  const s = snippetOf(body);
  return s.length >= 24 ? s : null;
}

/** Pure check used by tests and the live fetcher. */
export function evaluateLivePage(
  live: { url: string; title: string; text: string; words: number } | null,
  expected: PublishExpectation
): PublishCheckResult {
  if (!live) {
    return {
      ok: false,
      url: expected.url,
      reason: "Live URL could not be fetched after publish.",
      liveTitle: null,
      liveWords: 0,
    };
  }

  const title = live.title || "";
  const text = live.text || "";
  const hay = normalize(`${title} ${text}`);

  if (expected.changeType === "update_meta") {
    const want = (expected.title || "").trim();
    if (want && title.length >= TITLE_MIN && normalize(title).includes(normalize(want).slice(0, 40))) {
      return {
        ok: true,
        url: live.url,
        reason: "Live title matches the published meta.",
        liveTitle: title,
        liveWords: live.words,
      };
    }
    if (title.length >= TITLE_MIN) {
      return {
        ok: true,
        url: live.url,
        reason: "Live page has a title after the meta publish.",
        liveTitle: title,
        liveWords: live.words,
      };
    }
    return {
      ok: false,
      url: live.url,
      reason: "Live page still has no usable title after the meta publish.",
      liveTitle: title || null,
      liveWords: live.words,
    };
  }

  const keyword = (expected.keyword || "").trim();
  if (keyword && hay.includes(normalize(keyword))) {
    return {
      ok: true,
      url: live.url,
      reason: "Live page contains the target keyword.",
      liveTitle: title || null,
      liveWords: live.words,
    };
  }

  const snippet = (expected.bodySnippet || "").trim();
  if (snippet && hay.includes(normalize(snippet).slice(0, 48))) {
    return {
      ok: true,
      url: live.url,
      reason: "Live page contains published body text.",
      liveTitle: title || null,
      liveWords: live.words,
    };
  }

  const wantTitle = (expected.title || "").trim();
  if (wantTitle && title && normalize(title).includes(normalize(wantTitle).slice(0, 40))) {
    return {
      ok: true,
      url: live.url,
      reason: "Live title matches the published page.",
      liveTitle: title,
      liveWords: live.words,
    };
  }

  if (live.words >= 80 && title.length >= TITLE_MIN) {
    return {
      ok: true,
      url: live.url,
      reason: "Live page is present with a title and substantial text.",
      liveTitle: title,
      liveWords: live.words,
    };
  }

  return {
    ok: false,
    url: live.url,
    reason: "Live page does not show the published content yet.",
    liveTitle: title || null,
    liveWords: live.words,
  };
}

export async function checkPublishedPage(
  brand: Brand,
  expected: PublishExpectation
): Promise<PublishCheckResult> {
  const live = await inspectPage(expected.url, {
    render: canUse(brand, "js_rendering"),
  }).catch(() => null);

  const result = evaluateLivePage(
    live
      ? { url: live.url || expected.url, title: live.title, text: live.text, words: live.words }
      : null,
    expected
  );

  await db.from("publish_checks").insert({
    brand_id: brand.id,
    url: result.url,
    ok: result.ok,
    reason: result.reason,
    live_title: result.liveTitle,
    live_words: result.liveWords,
    change_type: expected.changeType,
    target_keyword: expected.keyword || null,
  }).then(({ error }) => {
    if (error) console.warn(`[publish-check] could not store result: ${error.message}`);
  });

  await recordActivity({
    brandId: brand.id,
    capability: "publish_checker",
    eventType: result.ok ? "publish_verified" : "publish_unverified",
    title: result.ok ? `Verified live: ${result.url}` : `Not verified live: ${result.url}`,
    detail: result.reason,
    status: result.ok ? "success" : "warning",
    metadata: { liveWords: result.liveWords, liveTitle: result.liveTitle },
  });

  return result;
}

export function absolutePageUrl(siteUrl: string | null | undefined, pageUrl: string | null | undefined): string | null {
  const page = (pageUrl || "").trim();
  if (!page) return null;
  if (/^https?:\/\//i.test(page)) return page;
  const origin = (siteUrl || "").replace(/\/$/, "");
  if (!origin) return null;
  const path = page.startsWith("/") ? page : `/${page}`;
  return `${origin}${path}`;
}
