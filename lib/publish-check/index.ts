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

const FETCH_MS = 10_000;

export type CertificationMode = "present" | "absent";

export type CertificationExpectation = {
  url: string;
  siteUrl: string;
  titleToken: string;
  bodyToken: string;
  mode: CertificationMode;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function normalizeCert(s: string): string {
  return decodeEntities(s).normalize("NFC").replace(/\s+/g, " ").trim();
}

export function hostMatchesSite(pageUrl: string, siteUrl: string): boolean {
  try {
    const pageHost = new URL(pageUrl).hostname.replace(/^www\./i, "").toLowerCase();
    const siteHost = new URL(siteUrl).hostname.replace(/^www\./i, "").toLowerCase();
    return pageHost === siteHost;
  } catch {
    return false;
  }
}

export type CertSnapshot =
  | { ok: true; status: number; url: string; title: string; text: string; canonical: string }
  | { ok: false; error: string };

export async function fetchCertificationSnapshot(url: string): Promise<CertSnapshot> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SEO-Platform-Auditor" },
      signal: AbortSignal.timeout(FETCH_MS),
      redirect: "follow",
    });
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";
    const canonical =
      html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)?.[1]?.trim() ||
      html.match(/<link[^>]+href=["']([^"']*)["'][^>]*rel=["']canonical["']/i)?.[1]?.trim() ||
      "";
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      ok: true,
      status: res.status,
      url: res.url || url,
      title,
      text,
      canonical,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function evaluateCertificationTokens(
  live: CertSnapshot,
  expected: CertificationExpectation
): PublishCheckResult {
  const fail = (reason: string, url = expected.url, title: string | null = null, words = 0): PublishCheckResult => ({
    ok: false,
    url,
    reason,
    liveTitle: title,
    liveWords: words,
  });

  if (!live.ok) {
    return fail("Live URL could not be fetched after publish.");
  }

  const title = normalizeCert(live.title);
  const text = normalizeCert(live.text);
  const titleToken = expected.titleToken;
  const bodyToken = expected.bodyToken;
  const words = live.text ? live.text.split(" ").length : 0;

  if (!hostMatchesSite(expected.url, expected.siteUrl)) {
    return fail("The test page address is not on this website.", live.url, live.title, words);
  }
  if (!hostMatchesSite(live.url, expected.siteUrl)) {
    return fail("The live page redirected off this website.", live.url, live.title, words);
  }
  if (live.canonical && /^https?:\/\//i.test(live.canonical) && !hostMatchesSite(live.canonical, expected.siteUrl)) {
    return fail("The live page points at a different website.", live.url, live.title, words);
  }

  if (expected.mode === "present") {
    if (live.status !== 200) {
      return fail("The test page is not live yet.", live.url, live.title, words);
    }
    if (!titleToken || !title.includes(titleToken)) {
      return fail("Live title does not contain the unique test marker.", live.url, live.title, words);
    }
    if (!bodyToken || !text.includes(bodyToken)) {
      return fail("Live page does not contain the unique test marker.", live.url, live.title, words);
    }
    return {
      ok: true,
      url: live.url,
      reason: "Live page shows the unique test markers.",
      liveTitle: live.title || null,
      liveWords: words,
    };
  }

  // absent: 404/410 OR 200 without either token
  if (live.status === 404 || live.status === 410) {
    return {
      ok: true,
      url: live.url,
      reason: "Test page is gone from the live site.",
      liveTitle: live.title || null,
      liveWords: words,
    };
  }
  if (live.status === 200 && (!title.includes(titleToken) && !text.includes(bodyToken))) {
    return {
      ok: true,
      url: live.url,
      reason: "Test markers are gone from the live site.",
      liveTitle: live.title || null,
      liveWords: words,
    };
  }
  return fail("The test page is still visible on the live site.", live.url, live.title, words);
}

export async function checkCertificationPage(
  brand: Brand,
  expected: CertificationExpectation,
  opts: { attempts?: number; delayMs?: number } = {}
): Promise<PublishCheckResult> {
  const attempts = Math.max(1, opts.attempts ?? 1);
  const delayMs = opts.delayMs ?? 3000;
  let result: PublishCheckResult | null = null;

  for (let i = 0; i < attempts; i++) {
    const live = await fetchCertificationSnapshot(expected.url);
    result = evaluateCertificationTokens(live, expected);
    if (result.ok) break;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }

  const finalResult = result!;
  await db
    .from("publish_checks")
    .insert({
      brand_id: brand.id,
      url: finalResult.url,
      ok: finalResult.ok,
      reason: finalResult.reason,
      live_title: finalResult.liveTitle,
      live_words: finalResult.liveWords,
      change_type: "certify_upsert_page",
      target_keyword: expected.titleToken,
    })
    .then(({ error }) => {
      if (error) console.warn(`[publish-check] could not store cert result: ${error.message}`);
    });

  return finalResult;
}
