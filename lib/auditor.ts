// SITE AUDITOR — crawls the brand's live site via its sitemap and evaluates each
// page's real content/title/meta. Works on ANY website (just needs a sitemap),
// which is what makes the platform sellable to Volo Locals customers.

import { callClaude, extractJSON } from "./anthropic";
import { brandBlock, type Brand } from "./brands";

// Fetch and parse the sitemap into a list of URLs.
async function sitemapUrls(siteUrl: string): Promise<string[]> {
  const base = siteUrl.replace(/\/$/, "");
  for (const path of ["/sitemap.xml", "/sitemap_index.xml"]) {
    try {
      const res = await fetch(base + path, { headers: { "User-Agent": "SEO-Platform-Auditor" } });
      if (!res.ok) continue;
      const xml = await res.text();
      const urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].trim());
      if (urls.length) return urls;
    } catch {
      /* try next */
    }
  }
  return [];
}

// One page as observed during a crawl. `status`, `canonical` and `robots` are
// read from the same response the auditor already downloads — they are extra
// extractions, not extra requests.
export type AuditedPage = {
  url: string;
  title: string;
  meta: string;
  h1: string;
  words: number;
  status: number | null;
  canonical: string;
  robots: string;
};

// Fetch a page and extract title, meta description, and visible text length.
async function inspectPage(url: string): Promise<AuditedPage | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "SEO-Platform-Auditor" } });
    if (!res.ok) return null;
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";
    const meta =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() || "";
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
    // Canonical + robots directives, taken from the HTML already in hand.
    // Attribute order varies, so match rel/href and name/content either way.
    const canonical =
      html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)?.[1]?.trim() ||
      html.match(/<link[^>]+href=["']([^"']*)["'][^>]*rel=["']canonical["']/i)?.[1]?.trim() ||
      "";
    const robots =
      html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i)?.[1]?.trim() ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']robots["']/i)?.[1]?.trim() ||
      "";
    // crude visible-text length (strip tags/scripts)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { url, title, meta, h1, words: text.split(" ").length, status: res.status, canonical, robots };
  } catch {
    return null;
  }
}

// Audit a sample of the site's pages and return prioritised issues.
export async function auditSite(brand: Brand, sampleSize = 12) {
  const urls = await sitemapUrls(brand.site_url);
  if (!urls.length) return { audited: 0, issues: [] };

  // Sample across the site (skip nothing important but cap for speed/cost).
  const step = Math.max(1, Math.floor(urls.length / sampleSize));
  const sample = urls.filter((_, i) => i % step === 0).slice(0, sampleSize);

  const pages = (await Promise.all(sample.map(inspectPage))).filter(
    (p): p is AuditedPage => p !== null
  );

  // The model sees exactly the same four fields it always has. The newly
  // captured status/canonical/robots are persisted for the Technical SEO
  // dataset but deliberately kept out of the prompt, so audit behaviour,
  // token cost and issue output are unchanged by this addition.
  const pagesForModel = pages.map((p) => ({
    url: p.url, title: p.title, meta: p.meta, h1: p.h1, words: p.words,
  }));

  const text = await callClaude({
    maxTokens: 1800,
    user: `${brandBlock(brand)}

You are the Site Auditor. Here are real pages from the live site (title, meta, h1, word count):
${JSON.stringify(pagesForModel, null, 2)}

Flag the highest-impact problems: thin content (low words), missing/weak/duplicate titles or metas, missing H1, and pages whose title/meta don't match strong buyer intent. For each, give a specific fix.
Return ONLY JSON:
{"issues":[{"url":"...","problem":"...","severity":"high|medium|low","fix":"...","task_type":"fix_meta|improve_content"}]}
Limit to the 10 most impactful.`,
  });
  const parsed = extractJSON<{
    issues: { url: string; problem: string; severity: string; fix: string; task_type: string }[];
  }>(text);
  // `pages` is additive — existing callers that only read audited/issues are
  // unaffected.
  return { audited: pages.length, issues: parsed?.issues || [], pages };
}
