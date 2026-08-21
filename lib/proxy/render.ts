// HTML renderer for proxied subdirectory pages.
// Reuses the publishing markdown converter (escapes before emit).

import { markdownToHtml } from "../execution/markdown";
import { splitFrontMatter } from "../utils";
import type { ProxyBrand } from "./resolve";

export type ProxyPage = {
  slug: string;
  title: string | null;
  body: string | null;
  meta_description: string | null;
  published_at: string | null;
  updated_at: string | null;
};

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripYamlFrontMatter(body: string): string {
  return body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

function plainExcerpt(text: string, max = 155): string {
  const flat = text
    .replace(/[#>*_`\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1).trimEnd() + "…";
}

export function resolveMetaDescription(page: ProxyPage): string {
  if (page.meta_description && page.meta_description.trim()) {
    return page.meta_description.trim();
  }
  const raw = page.body || "";
  const { meta, body } = splitFrontMatter(stripYamlFrontMatter(raw), page.title || "");
  if (meta) return meta;
  return plainExcerpt(body || raw);
}

export function renderNotFound(brand: ProxyBrand, host: string): string {
  const title = escapeAttr(`Not found — ${brand.name}`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="robots" content="noindex" />
</head>
<body>
<main>
<h1>Page not found</h1>
<p>Nothing is published at this address for ${escapeAttr(brand.name)}.</p>
<p><a href="https://${escapeAttr(host)}/">Back to site</a></p>
</main>
</body>
</html>`;
}

export function renderPage(input: {
  brand: ProxyBrand;
  page: ProxyPage;
  canonical: string;
  noindex: boolean;
}): string {
  const { brand, page, canonical, noindex } = input;
  const title = (page.title || brand.name).trim() || brand.name;
  const description = resolveMetaDescription(page);
  const rawBody = stripYamlFrontMatter(page.body || "");
  const { body: cleaned } = splitFrontMatter(rawBody, title);
  const htmlBody = markdownToHtml(cleaned || rawBody);

  const robots = noindex ? "noindex,nofollow" : "index,follow";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": page.slug.startsWith("blog/") ? "Article" : "WebPage",
    headline: title,
    description,
    url: canonical,
    datePublished: page.published_at || undefined,
    dateModified: page.updated_at || page.published_at || undefined,
    publisher: { "@type": "Organization", name: brand.name, url: brand.site_url },
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeAttr(title)}</title>
<meta name="description" content="${escapeAttr(description)}" />
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${escapeAttr(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeAttr(title)}" />
<meta property="og:description" content="${escapeAttr(description)}" />
<meta property="og:url" content="${escapeAttr(canonical)}" />
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
</head>
<body>
<main>
<article>
<h1>${escapeAttr(title)}</h1>
${htmlBody}
</article>
</main>
</body>
</html>`;
}
