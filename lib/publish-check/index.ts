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
  metaDescription?: string | null;
};

export type PublishCheckResult = {
  ok: boolean;
  url: string;
  reason: string;
  liveTitle: string | null;
  liveWords: number;
};

export type LivePageSnapshot = {
  url: string;
  title: string;
  text: string;
  words: number;
  meta?: string | null;
};

const TITLE_MIN = 5;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesNeedle(hay: string, needle: string, max = 40): boolean {
  const n = normalize(needle).slice(0, max);
  return n.length > 0 && hay.includes(n);
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
  live: LivePageSnapshot | null,
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
  const meta = live.meta || "";
  const hay = normalize(`${title} ${text}`);
  const fail = (reason: string): PublishCheckResult => ({
    ok: false,
    url: live.url,
    reason,
    liveTitle: title || null,
    liveWords: live.words,
  });
  const pass = (reason: string): PublishCheckResult => ({
    ok: true,
    url: live.url,
    reason,
    liveTitle: title || null,
    liveWords: live.words,
  });

  if (expected.changeType === "update_meta") {
    const wantTitle = (expected.title || "").trim();
    const wantMeta = (expected.metaDescription || "").trim();
    if (!wantTitle && !wantMeta) {
      return fail("No title or description was provided to verify on the live page.");
    }
    if (wantTitle && (title.length < TITLE_MIN || !includesNeedle(normalize(title), wantTitle))) {
      return fail("Live title does not match the published title.");
    }
    if (wantMeta && !includesNeedle(normalize(meta), wantMeta, 48)) {
      return fail("Live description does not match the published description.");
    }
    return pass(
      wantTitle ? "Live title matches the published meta." : "Live description matches the published meta."
    );
  }

  const snippet = (expected.bodySnippet || "").trim();
  if (snippet && includesNeedle(hay, snippet, 48)) {
    return pass("Live page contains published body text.");
  }

  const wantTitle = (expected.title || "").trim();
  if (wantTitle && title && includesNeedle(normalize(title), wantTitle)) {
    return pass("Live title matches the published page.");
  }

  if (snippet || wantTitle) {
    return fail("Live page does not show the published content yet.");
  }

  return fail("Live page does not show the published content yet.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkPublishedPage(
  brand: Brand,
  expected: PublishExpectation,
  opts: { attempts?: number; delayMs?: number } = {}
): Promise<PublishCheckResult> {
  const attempts = Math.max(1, opts.attempts ?? 1);
  const delayMs = opts.delayMs ?? 2000;
  let result: PublishCheckResult | null = null;

  for (let i = 0; i < attempts; i++) {
    const live = await inspectPage(expected.url, {
      render: canUse(brand, "js_rendering"),
    }).catch(() => null);

    result = evaluateLivePage(
      live
        ? {
            url: live.url || expected.url,
            title: live.title,
            text: live.text,
            words: live.words,
            meta: live.meta,
          }
        : null,
      expected
    );
    if (result.ok) break;
    if (i < attempts - 1) await sleep(delayMs);
  }

  const finalResult = result!;

  await db.from("publish_checks").insert({
    brand_id: brand.id,
    url: finalResult.url,
    ok: finalResult.ok,
    reason: finalResult.reason,
    live_title: finalResult.liveTitle,
    live_words: finalResult.liveWords,
    change_type: expected.changeType,
    target_keyword: expected.keyword || null,
  }).then(({ error }) => {
    if (error) console.warn(`[publish-check] could not store result: ${error.message}`);
  });

  await recordActivity({
    brandId: brand.id,
    capability: "publish_checker",
    eventType: finalResult.ok ? "publish_verified" : "publish_unverified",
    title: finalResult.ok ? `Verified live: ${finalResult.url}` : `Not verified live: ${finalResult.url}`,
    detail: finalResult.reason,
    status: finalResult.ok ? "success" : "warning",
    metadata: { liveWords: finalResult.liveWords, liveTitle: finalResult.liveTitle },
  });

  return finalResult;
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
