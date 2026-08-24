/**
 * Connect Website — detect platform from a URL and recommend a connector.
 * Detection is advisory; customers can always pick a different method.
 */

import type { WebsiteAdapterId } from "./capabilities";

export type DetectedPlatformHint =
  | "wordpress"
  | "shopify"
  | "wix"
  | "webflow"
  | "nextjs"
  | "git"
  | "sanity"
  | "unknown";

export type ConnectorStatus = "functional" | "limited" | "unsupported";

export type ConnectorOption = {
  id: WebsiteAdapterId | "gitlab" | "bitbucket" | "azure_devops" | "wix" | "webflow" | "contentful" | "strapi" | "ftp";
  label: string;
  status: ConnectorStatus;
  /** Shown when recommending. */
  reason: string;
  /** Maps to an authorize path we can actually run. */
  connectable: boolean;
  /** Engine / integration provider when connectable. */
  platform?: "wordpress" | "shopify" | "webhook" | "proxy" | "github" | "sanity";
};

/** Only connectors we can authorize and publish with today. */
export const FUNCTIONAL_CONNECTORS: ConnectorOption[] = [
  {
    id: "wordpress",
    label: "WordPress",
    status: "functional",
    reason: "Native pages, blog posts, and meta when an SEO plugin is available.",
    connectable: true,
    platform: "wordpress",
  },
  {
    id: "shopify",
    label: "Shopify",
    status: "limited",
    reason: "Can publish Online Store pages. Blog posts and meta updates are not supported yet.",
    connectable: true,
    platform: "shopify",
  },
  {
    id: "github",
    label: "GitHub",
    status: "functional",
    reason: "Coded sites: changes ship as a pull request (never silent production edits).",
    connectable: true,
    platform: "github",
  },
  {
    id: "sanity",
    label: "Sanity",
    status: "limited",
    reason: "Can create and update documents when a write token is provided.",
    connectable: true,
    platform: "sanity",
  },
  {
    id: "webhook",
    label: "Custom publish endpoint",
    status: "limited",
    reason: "For sites with a signed HTTPS receiver. You must deploy the receiver yourself.",
    connectable: true,
    platform: "webhook",
  },
  {
    id: "managed_pages",
    label: "Volo Managed Pages",
    status: "limited",
    reason: "Fallback: new pages on your domain. Does not edit your existing site or native blog.",
    connectable: true,
    platform: "proxy",
  },
];

/** Named in product plans but not connectable — never shown as Available. */
export const UNSUPPORTED_CONNECTORS: ConnectorOption[] = [
  { id: "wix", label: "Wix", status: "unsupported", reason: "No working connector yet.", connectable: false },
  { id: "webflow", label: "Webflow", status: "unsupported", reason: "No working connector yet.", connectable: false },
  { id: "gitlab", label: "GitLab", status: "unsupported", reason: "Use GitHub for now, or Managed Pages.", connectable: false },
  { id: "bitbucket", label: "Bitbucket", status: "unsupported", reason: "Use GitHub for now, or Managed Pages.", connectable: false },
  { id: "azure_devops", label: "Azure DevOps", status: "unsupported", reason: "Use GitHub for now, or Managed Pages.", connectable: false },
  { id: "contentful", label: "Contentful", status: "unsupported", reason: "No working connector yet.", connectable: false },
  { id: "strapi", label: "Strapi", status: "unsupported", reason: "No working connector yet.", connectable: false },
  { id: "ftp", label: "FTP / SFTP", status: "unsupported", reason: "Last-resort path not enabled — too fragile for auto SEO.", connectable: false },
];

export type WebsiteDetectResult = {
  url: string;
  origin: string;
  hint: DetectedPlatformHint;
  confidence: "low" | "medium" | "high";
  signals: { id: string; evidence: string }[];
  /** Best connectable option first. */
  recommended: ConnectorOption;
  alternatives: ConnectorOption[];
  /** Unsupported options (informational only). */
  unavailable: ConnectorOption[];
};

function originOf(raw: string): string | null {
  try {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^(ftp|sftp|file):/i.test(trimmed)) return null;
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (u.protocol !== "https:") return null;
    if (!u.hostname || u.hostname.includes("://")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

async function fetchSlice(url: string): Promise<{ status: number; body: string; headers: Headers } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Volo-Website-Detect" },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    const body = await res.text();
    return { status: res.status, body: body.slice(0, 100_000), headers: res.headers };
  } catch {
    return null;
  }
}

function pickRecommended(hint: DetectedPlatformHint): ConnectorOption {
  if (hint === "wordpress") return FUNCTIONAL_CONNECTORS.find((c) => c.id === "wordpress")!;
  if (hint === "shopify") return FUNCTIONAL_CONNECTORS.find((c) => c.id === "shopify")!;
  if (hint === "sanity") return FUNCTIONAL_CONNECTORS.find((c) => c.id === "sanity")!;
  if (hint === "nextjs" || hint === "git") return FUNCTIONAL_CONNECTORS.find((c) => c.id === "github")!;
  // Wix/Webflow detected but unsupported → Managed Pages fallback
  if (hint === "wix" || hint === "webflow") {
    return FUNCTIONAL_CONNECTORS.find((c) => c.id === "managed_pages")!;
  }
  return FUNCTIONAL_CONNECTORS.find((c) => c.id === "managed_pages")!;
}

/**
 * Probe a public URL and recommend the easiest functional connector.
 * Never recommends an unsupported connector as primary.
 */
export async function detectWebsite(rawUrl: string): Promise<WebsiteDetectResult | { error: string }> {
  const origin = originOf(rawUrl.trim());
  if (!origin) {
    return { error: "Enter a full https:// website address." };
  }

  const signals: { id: string; evidence: string }[] = [];
  let wordpress = 0;
  let shopify = 0;
  let wix = 0;
  let webflow = 0;
  let nextjs = 0;
  let git = 0;
  let sanity = 0;

  const [home, wpJson] = await Promise.all([
    fetchSlice(origin + "/"),
    fetchSlice(origin + "/wp-json/"),
  ]);

  if (home) {
    const body = home.body.toLowerCase();
    const headers: Record<string, string> = {};
    home.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    if (body.includes("wp-content") || body.includes("wordpress") || headers["x-powered-by"]?.includes("WordPress")) {
      wordpress += 2;
      signals.push({ id: "wp_html", evidence: "Homepage looks like WordPress." });
    }
    if (body.includes("cdn.shopify.com") || body.includes("myshopify") || headers["x-shopify-stage"]) {
      shopify += 3;
      signals.push({ id: "shopify_html", evidence: "Homepage looks like Shopify." });
    }
    if (body.includes("static.wixstatic.com") || body.includes("wix.com")) {
      wix += 3;
      signals.push({ id: "wix_html", evidence: "Homepage looks like Wix." });
    }
    if (body.includes("webflow") || headers["x-wf-"]) {
      webflow += 3;
      signals.push({ id: "webflow_html", evidence: "Homepage looks like Webflow." });
    }
    if (
      body.includes("__next") ||
      body.includes("/_next/") ||
      headers["x-powered-by"]?.toLowerCase().includes("next") ||
      headers["x-vercel-id"]
    ) {
      nextjs += 2;
      signals.push({ id: "next_html", evidence: "Homepage looks like Next.js / Vercel." });
    }
    if (body.includes("cdn.sanity.io") || body.includes("sanity.io")) {
      sanity += 2;
      signals.push({ id: "sanity_html", evidence: "Sanity CDN references found." });
    }
    if (body.includes("github.io") || origin.includes("github.io")) {
      git += 2;
      signals.push({ id: "github_pages", evidence: "GitHub Pages host detected." });
    }
  }

  if (wpJson && wpJson.status === 200 && wpJson.body.includes("namespaces")) {
    wordpress += 4;
    signals.push({ id: "wp_json", evidence: "WordPress REST API is reachable." });
  }

  let hint: DetectedPlatformHint = "unknown";
  let confidence: "low" | "medium" | "high" = "low";
  const scores: [DetectedPlatformHint, number][] = [
    ["wordpress", wordpress],
    ["shopify", shopify],
    ["wix", wix],
    ["webflow", webflow],
    ["sanity", sanity],
    ["nextjs", nextjs],
    ["git", git],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  if (scores[0][1] >= 4) {
    hint = scores[0][0];
    confidence = "high";
  } else if (scores[0][1] >= 2) {
    hint = scores[0][0];
    confidence = "medium";
  } else {
    signals.push({ id: "unknown", evidence: "No clear CMS fingerprint — Managed Pages is the safe fallback." });
  }

  const recommended = pickRecommended(hint);
  const alternatives = FUNCTIONAL_CONNECTORS.filter((c) => c.id !== recommended.id);

  return {
    url: origin,
    origin,
    hint,
    confidence,
    signals,
    recommended,
    alternatives,
    unavailable: UNSUPPORTED_CONNECTORS,
  };
}
