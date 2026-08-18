// ON-PAGE SEO ANALYSIS — pure functions over one fetched HTML document.
//
// This is what makes the public audit honest. Every check below is decided by
// evidence in the page we actually downloaded: a tag is present or it is not, a
// length is inside a range or it is not. Nothing is estimated, and nothing is
// scored from data we do not hold.
//
// What is deliberately NOT here: backlinks, referring domains, keyword volume,
// competitor gaps and ranking history. Those need Search Console or a paid data
// provider, so the audit reports them as "connect to unlock" rather than
// inventing a number to fill a card. See lib/audit/report.ts.

export type CheckStatus = "pass" | "warn" | "fail";
export type CheckImpact = "high" | "medium" | "low";
export type CheckCategory = "content" | "technical" | "mobile" | "social";

export type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  /** What we found, in the site owner's language. */
  detail: string;
  /** What to do about it. Empty when the check passed. */
  fix: string;
  impact: CheckImpact;
  category: CheckCategory;
};

export type PageFacts = {
  title: string;
  metaDescription: string;
  h1s: string[];
  h2Count: number;
  imgTotal: number;
  imgWithAlt: number;
  canonical: string;
  viewport: string;
  robotsMeta: string;
  lang: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  jsonLdBlocks: number;
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  isHttps: boolean;
  hasFavicon: boolean;
  responseMs: number;
};

const IMPACT_WEIGHT: Record<CheckImpact, number> = { high: 3, medium: 2, low: 1 };
const STATUS_CREDIT: Record<CheckStatus, number> = { pass: 1, warn: 0.5, fail: 0 };

function textBetween(html: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  for (const m of html.matchAll(re)) {
    out.push(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }
  return out;
}

/** Read a <meta> content value by name or property, in either attribute order. */
function metaContent(html: string, key: string, attr: "name" | "property" = "name"): string {
  const a = html.match(
    new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
  );
  if (a) return a[1].trim();
  const b = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`, "i"),
  );
  return b ? b[1].trim() : "";
}

/** Extract every fact the checks below reason about. No judgement here. */
export function extractFacts(html: string, finalUrl: string, responseMs: number): PageFacts {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const visibleText = stripped
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgWithAlt = imgTags.filter((t) => /\balt\s*=\s*["'][^"']*\S[^"']*["']/i.test(t)).length;

  let host = "";
  try {
    host = new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch {
    /* finalUrl is validated upstream; fall through with an empty host */
  }

  let internalLinks = 0;
  let externalLinks = 0;
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    const href = m[1].trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    if (/^https?:\/\//i.test(href)) {
      try {
        const linkHost = new URL(href).hostname.replace(/^www\./, "");
        if (host && linkHost === host) internalLinks++;
        else externalLinks++;
      } catch {
        /* unparseable href — not counted either way */
      }
    } else {
      internalLinks++;
    }
  }

  return {
    title: textBetween(html, "title")[0] || "",
    metaDescription: metaContent(html, "description"),
    h1s: textBetween(html, "h1").filter(Boolean),
    h2Count: textBetween(html, "h2").filter(Boolean).length,
    imgTotal: imgTags.length,
    imgWithAlt,
    canonical:
      html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)?.[1]?.trim() ||
      html.match(/<link[^>]+href=["']([^"']*)["'][^>]*rel=["']canonical["']/i)?.[1]?.trim() ||
      "",
    viewport: metaContent(html, "viewport"),
    robotsMeta: metaContent(html, "robots"),
    lang: html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1]?.trim() || "",
    ogTitle: metaContent(html, "og:title", "property"),
    ogDescription: metaContent(html, "og:description", "property"),
    ogImage: metaContent(html, "og:image", "property"),
    jsonLdBlocks: [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi)].length,
    wordCount: visibleText ? visibleText.split(/\s+/).filter(Boolean).length : 0,
    internalLinks,
    externalLinks,
    isHttps: finalUrl.startsWith("https://"),
    hasFavicon: /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(html),
    responseMs,
  };
}

/** Turn facts into graded checks. Ordered so the worst news is not buried. */
export function runChecks(f: PageFacts): Check[] {
  const checks: Check[] = [];

  // ── Title ──
  const titleLen = f.title.length;
  checks.push({
    id: "title",
    label: "Page title",
    impact: "high",
    category: "content",
    ...(titleLen === 0
      ? {
          status: "fail" as const,
          detail: "This page has no title tag.",
          fix: "Add a 50–60 character title with your main keyword and business name.",
        }
      : titleLen < 30
        ? {
            status: "warn" as const,
            detail: `Your title is only ${titleLen} characters ("${f.title}").`,
            fix: "Expand it toward 50–60 characters so it earns more space in results.",
          }
        : titleLen > 65
          ? {
              status: "warn" as const,
              detail: `Your title is ${titleLen} characters, so Google will likely truncate it.`,
              fix: "Trim it to under 60 characters and put the important words first.",
            }
          : {
              status: "pass" as const,
              detail: `${titleLen} characters — a good length.`,
              fix: "",
            }),
  });

  // ── Meta description ──
  const descLen = f.metaDescription.length;
  checks.push({
    id: "meta_description",
    label: "Meta description",
    impact: "high",
    category: "content",
    ...(descLen === 0
      ? {
          status: "fail" as const,
          detail: "No meta description, so Google writes your search snippet for you.",
          fix: "Write a 140–160 character description that states the offer and a reason to click.",
        }
      : descLen < 70
        ? {
            status: "warn" as const,
            detail: `Your description is only ${descLen} characters.`,
            fix: "Extend it toward 150 characters to use the full snippet width.",
          }
          : descLen > 165
            ? {
                status: "warn" as const,
                detail: `Your description is ${descLen} characters and will be cut off.`,
                fix: "Trim to about 155 characters.",
              }
            : {
                status: "pass" as const,
                detail: `${descLen} characters — a good length.`,
                fix: "",
              }),
  });

  // ── H1 ──
  checks.push({
    id: "h1",
    label: "Main heading (H1)",
    impact: "high",
    category: "content",
    ...(f.h1s.length === 0
      ? {
          status: "fail" as const,
          detail: "No H1 heading was found on this page.",
          fix: "Add exactly one H1 that describes what the page is about.",
        }
      : f.h1s.length > 1
        ? {
            status: "warn" as const,
            detail: `Found ${f.h1s.length} H1 headings, which splits the page's topic.`,
            fix: "Keep one H1 and demote the rest to H2.",
          }
        : {
            status: "pass" as const,
            detail: `One clear H1: "${f.h1s[0].slice(0, 70)}".`,
            fix: "",
          }),
  });

  // ── Subheadings ──
  checks.push({
    id: "headings",
    label: "Subheading structure",
    impact: "medium",
    category: "content",
    ...(f.h2Count === 0
      ? {
          status: "warn" as const,
          detail: "No H2 subheadings, so the page reads as one undivided block.",
          fix: "Break the content into sections with descriptive H2s.",
        }
      : {
          status: "pass" as const,
          detail: `${f.h2Count} subheading${f.h2Count === 1 ? "" : "s"} give the page structure.`,
          fix: "",
        }),
  });

  // ── Content depth ──
  checks.push({
    id: "content_depth",
    label: "Content depth",
    impact: "high",
    category: "content",
    ...(f.wordCount < 150
      ? {
          status: "fail" as const,
          detail: `Only about ${f.wordCount} words of text were found.`,
          fix: "Thin pages rarely rank. Aim for genuinely useful depth on pages you want traffic from.",
        }
      : f.wordCount < 400
        ? {
            status: "warn" as const,
            detail: `About ${f.wordCount} words — light for a page you want to rank.`,
            fix: "Answer the questions a buyer actually asks before choosing.",
          }
        : {
            status: "pass" as const,
            detail: `About ${f.wordCount.toLocaleString()} words of readable content.`,
            fix: "",
          }),
  });

  // ── Image alt text ──
  const altPct = f.imgTotal ? Math.round((f.imgWithAlt / f.imgTotal) * 100) : 100;
  checks.push({
    id: "image_alt",
    label: "Image alt text",
    impact: "medium",
    category: "content",
    ...(f.imgTotal === 0
      ? {
          status: "pass" as const,
          detail: "No images on this page, so there is nothing to describe.",
          fix: "",
        }
      : altPct < 60
        ? {
            status: "fail" as const,
            detail: `${f.imgTotal - f.imgWithAlt} of ${f.imgTotal} images have no alt text.`,
            fix: "Describe each meaningful image — it helps accessibility and image search.",
          }
        : altPct < 100
          ? {
              status: "warn" as const,
              detail: `${f.imgWithAlt} of ${f.imgTotal} images have alt text (${altPct}%).`,
              fix: "Add alt text to the remaining images.",
            }
          : {
              status: "pass" as const,
              detail: `All ${f.imgTotal} images have alt text.`,
              fix: "",
            }),
  });

  // ── HTTPS ──
  checks.push({
    id: "https",
    label: "Secure connection",
    impact: "high",
    category: "technical",
    ...(f.isHttps
      ? { status: "pass" as const, detail: "Served over HTTPS.", fix: "" }
      : {
          status: "fail" as const,
          detail: "This page is served over plain HTTP.",
          fix: "Install an SSL certificate and redirect all HTTP traffic to HTTPS.",
        }),
  });

  // ── Mobile viewport ──
  checks.push({
    id: "viewport",
    label: "Mobile viewport",
    impact: "high",
    category: "mobile",
    ...(f.viewport
      ? { status: "pass" as const, detail: "A mobile viewport is declared.", fix: "" }
      : {
          status: "fail" as const,
          detail: "No viewport tag, so this page will not scale correctly on phones.",
          fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
        }),
  });

  // ── Indexability ──
  const noindex = /noindex/i.test(f.robotsMeta);
  checks.push({
    id: "indexable",
    label: "Search engine indexing",
    impact: "high",
    category: "technical",
    ...(noindex
      ? {
          status: "fail" as const,
          detail: "This page tells search engines not to index it.",
          fix: "Remove the noindex directive if you want this page to rank.",
        }
      : { status: "pass" as const, detail: "Search engines are allowed to index this page.", fix: "" }),
  });

  // ── Canonical ──
  checks.push({
    id: "canonical",
    label: "Canonical URL",
    impact: "medium",
    category: "technical",
    ...(f.canonical
      ? { status: "pass" as const, detail: "A canonical URL is set.", fix: "" }
      : {
          status: "warn" as const,
          detail: "No canonical tag, which can cause duplicate-content confusion.",
          fix: "Add a canonical link pointing at the preferred version of this page.",
        }),
  });

  // ── Structured data ──
  checks.push({
    id: "structured_data",
    label: "Structured data",
    impact: "medium",
    category: "technical",
    ...(f.jsonLdBlocks > 0
      ? {
          status: "pass" as const,
          detail: `${f.jsonLdBlocks} structured-data block${f.jsonLdBlocks === 1 ? "" : "s"} found.`,
          fix: "",
        }
      : {
          status: "warn" as const,
          detail: "No structured data, so you are not eligible for rich results.",
          fix: "Add schema.org markup for your business, products or articles.",
        }),
  });

  // ── Social preview ──
  const ogCount = [f.ogTitle, f.ogDescription, f.ogImage].filter(Boolean).length;
  checks.push({
    id: "social",
    label: "Social sharing preview",
    impact: "low",
    category: "social",
    ...(ogCount === 3
      ? { status: "pass" as const, detail: "Open Graph title, description and image are all set.", fix: "" }
      : ogCount === 0
        ? {
            status: "warn" as const,
            detail: "No Open Graph tags, so shared links show an unstyled preview.",
            fix: "Add og:title, og:description and og:image.",
          }
        : {
            status: "warn" as const,
            detail: `Only ${ogCount} of 3 Open Graph tags are set.`,
            fix: "Complete og:title, og:description and og:image.",
          }),
  });

  // ── Language ──
  checks.push({
    id: "lang",
    label: "Declared language",
    impact: "low",
    category: "technical",
    ...(f.lang
      ? { status: "pass" as const, detail: `Language declared as "${f.lang}".`, fix: "" }
      : {
          status: "warn" as const,
          detail: "The page does not declare a language.",
          fix: 'Add a lang attribute to the <html> tag, e.g. lang="en".',
        }),
  });

  // ── Internal linking ──
  checks.push({
    id: "internal_links",
    label: "Internal linking",
    impact: "medium",
    category: "content",
    ...(f.internalLinks < 3
      ? {
          status: "warn" as const,
          detail: `Only ${f.internalLinks} internal link${f.internalLinks === 1 ? "" : "s"} found.`,
          fix: "Link to your related pages so visitors and crawlers can reach them.",
        }
      : {
          status: "pass" as const,
          detail: `${f.internalLinks} internal links help spread authority.`,
          fix: "",
        }),
  });

  // ── Speed (server response only — honest about what we measured) ──
  checks.push({
    id: "response_time",
    label: "Server response time",
    impact: "medium",
    category: "technical",
    ...(f.responseMs > 2500
      ? {
          status: "fail" as const,
          detail: `The page took ${(f.responseMs / 1000).toFixed(1)}s to respond.`,
          fix: "Slow responses hurt rankings and conversions. Check hosting, caching and heavy plugins.",
        }
      : f.responseMs > 1200
        ? {
            status: "warn" as const,
            detail: `The page responded in ${(f.responseMs / 1000).toFixed(1)}s.`,
            fix: "Aim for under one second with caching or a CDN.",
          }
        : {
            status: "pass" as const,
            detail: `Responded in ${(f.responseMs / 1000).toFixed(1)}s.`,
            fix: "",
          }),
  });

  return checks;
}

/** Weighted 0–100 score. High-impact failures move it the most. */
export function scoreChecks(checks: Check[]): number {
  if (!checks.length) return 0;
  let earned = 0;
  let possible = 0;
  for (const c of checks) {
    const w = IMPACT_WEIGHT[c.impact];
    possible += w;
    earned += w * STATUS_CREDIT[c.status];
  }
  return Math.round((earned / possible) * 100);
}

export function countByStatus(checks: Check[]): Record<CheckStatus, number> {
  return checks.reduce(
    (acc, c) => {
      acc[c.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 } as Record<CheckStatus, number>,
  );
}

/** Grade band used for the headline verdict. */
export function scoreBand(score: number): { label: string; tone: "good" | "mixed" | "poor" } {
  if (score >= 80) return { label: "Strong foundation", tone: "good" };
  if (score >= 60) return { label: "Needs work", tone: "mixed" };
  return { label: "Losing traffic", tone: "poor" };
}
