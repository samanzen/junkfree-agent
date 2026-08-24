// SOURCE OF TRUTH — where new pages actually get saved.
//
// Detection may suggest. A human confirms. Framework fingerprints never
// select the writer and never become confirmed. Brand remains the site.

import { db } from "../supabase";
import { getBrandById } from "../brands";
import { isSitePlatform } from "./registry";
import {
  markCertifiedOperationsStale,
  parseCapabilityMap,
  isOperationCertified,
} from "./site-capabilities";
import type { AdapterCapability, SitePlatform } from "./types";

export const CERTIFICATION_TTL_MS = 90 * 864e5;

export type DetectedSourceOfTruth =
  | "wordpress"
  | "shopify"
  | "application_database"
  | "git"
  | "sanity"
  | "unknown";

export type ConfirmedSourceOfTruth =
  | "wordpress"
  | "shopify"
  | "application_database"
  | "platform_proxy"
  | "unknown";

export type SourceConfidence = "low" | "medium" | "high";

export type SourceSignal = { id: string; evidence: string };

export type SourceOfTruth = {
  detected: DetectedSourceOfTruth | null;
  confidence: SourceConfidence | null;
  signals: SourceSignal[];
  detected_at: string | null;
  confirmed: ConfirmedSourceOfTruth | null;
  confirmed_at: string | null;
};

export const CONFIRMED_OPTIONS: { value: ConfirmedSourceOfTruth; label: string }[] = [
  { value: "wordpress", label: "WordPress" },
  { value: "shopify", label: "Shopify" },
  { value: "application_database", label: "In our own website or database" },
  { value: "platform_proxy", label: "Volo Managed Pages on our domain" },
  { value: "unknown", label: "I don't know" },
];

const EMPTY: SourceOfTruth = {
  detected: null,
  confidence: null,
  signals: [],
  detected_at: null,
  confirmed: null,
  confirmed_at: null,
};

export function emptySourceOfTruth(): SourceOfTruth {
  return { ...EMPTY, signals: [] };
}

export function isConfirmedSourceOfTruth(value: unknown): value is ConfirmedSourceOfTruth {
  return (
    value === "wordpress" ||
    value === "shopify" ||
    value === "application_database" ||
    value === "platform_proxy" ||
    value === "unknown"
  );
}

export function parseSourceOfTruth(raw: unknown): SourceOfTruth {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptySourceOfTruth();
  const r = raw as Record<string, unknown>;
  const detected =
    r.detected === "wordpress" ||
    r.detected === "shopify" ||
    r.detected === "application_database" ||
    r.detected === "git" ||
    r.detected === "sanity" ||
    r.detected === "unknown"
      ? r.detected
      : null;
  const confidence =
    r.confidence === "low" || r.confidence === "medium" || r.confidence === "high" ? r.confidence : null;
  const signals = Array.isArray(r.signals)
    ? r.signals
        .filter((s): s is SourceSignal => {
          if (!s || typeof s !== "object" || Array.isArray(s)) return false;
          const row = s as Record<string, unknown>;
          return typeof row.id === "string" && typeof row.evidence === "string";
        })
        .slice(0, 16)
    : [];
  return {
    detected,
    confidence,
    signals,
    detected_at: typeof r.detected_at === "string" ? r.detected_at : null,
    confirmed: isConfirmedSourceOfTruth(r.confirmed) ? r.confirmed : null,
    confirmed_at: typeof r.confirmed_at === "string" ? r.confirmed_at : null,
  };
}

/** Confirmed SoT → the writer that may certify. Null means no Autopilot / no prove. */
export function writerForConfirmed(confirmed: ConfirmedSourceOfTruth | null): SitePlatform | null {
  if (confirmed === "wordpress") return "wordpress";
  if (confirmed === "shopify") return "shopify";
  if (confirmed === "application_database") return "webhook";
  if (confirmed === "platform_proxy") return "proxy";
  return null;
}

export function sourceOfTruthMatchesWriter(
  sot: SourceOfTruth | null | undefined,
  writer: string | null | undefined
): boolean {
  if (!sot?.confirmed || sot.confirmed === "unknown") return false;
  if (!isSitePlatform(writer)) return false;
  return writerForConfirmed(sot.confirmed) === writer;
}

/**
 * Autopilot may live-write only when Slice 0 certified the op, SoT matches
 * the pinned writer, and the stamp is still fresh. Same policy flag as Slice 0.
 */
export function isOperationAutopilotReady(
  brand: {
    primary_writer?: string | null;
    site_capabilities?: unknown;
    source_of_truth?: unknown;
  },
  op: AdapterCapability
): boolean {
  if (!isOperationCertified(brand.site_capabilities, op)) return false;
  const map = parseCapabilityMap(brand.site_capabilities);
  const writer = brand.primary_writer;
  if (!isSitePlatform(writer) || map[op]?.writer !== writer) return false;
  const certifiedAt = map[op]?.certified_at;
  if (certifiedAt) {
    const t = Date.parse(certifiedAt);
    if (Number.isFinite(t) && Date.now() - t > CERTIFICATION_TTL_MS) return false;
  }
  return sourceOfTruthMatchesWriter(parseSourceOfTruth(brand.source_of_truth), writer);
}

export async function persistSourceOfTruth(
  brandId: string,
  patch: Partial<SourceOfTruth>
): Promise<void> {
  const brand = await getBrandById(brandId).catch(() => null);
  const current = parseSourceOfTruth(brand?.source_of_truth);
  const next: SourceOfTruth = {
    ...current,
    ...patch,
    signals: patch.signals ?? current.signals,
  };
  const { error } = await db
    .from("brands")
    .update({ source_of_truth: next })
    .eq("id", brandId);
  if (error) {
    throw new Error(
      `Could not save where pages are stored (${error.message}). Apply supabase/021_source_of_truth.sql in Supabase, then try again.`
    );
  }
}

export async function confirmSourceOfTruth(
  brandId: string,
  confirmed: ConfirmedSourceOfTruth
): Promise<SourceOfTruth> {
  const brand = await getBrandById(brandId);
  const current = parseSourceOfTruth(brand?.source_of_truth);
  const changed = current.confirmed !== null && current.confirmed !== confirmed;
  const next: SourceOfTruth = {
    ...current,
    confirmed,
    confirmed_at: new Date().toISOString(),
  };
  await persistSourceOfTruth(brandId, next);
  if (changed) await markCertifiedOperationsStale(brandId);
  return next;
}

const FETCH_MS = 8_000;

async function fetchText(url: string): Promise<{ status: number; headers: Headers; body: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SEO-Platform-Auditor" },
      signal: AbortSignal.timeout(FETCH_MS),
      redirect: "follow",
    });
    const body = await res.text();
    return { status: res.status, headers: res.headers, body: body.slice(0, 80_000) };
  } catch {
    return null;
  }
}

function originOf(siteUrl: string): string | null {
  try {
    const u = new URL(siteUrl);
    if (u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

export type ProbeResult = {
  detected: DetectedSourceOfTruth;
  confidence: SourceConfidence;
  signals: SourceSignal[];
};

/**
 * Deterministic probe. Never writes `confirmed`. Framework fingerprints cap
 * at medium and never become the Source of Truth.
 */
export function scoreSourceSignals(input: {
  connectedWriter?: SitePlatform | null;
  homepage?: { status: number; headers: Headers | Record<string, string>; body: string } | null;
  wpJson?: { status: number; body: string } | null;
}): ProbeResult {
  const signals: SourceSignal[] = [];
  let wordpress = 0;
  let shopify = 0;
  let app = 0;
  let git = 0;
  let sanity = 0;

  if (input.connectedWriter === "wordpress") {
    wordpress += 3;
    signals.push({ id: "connected_wordpress", evidence: "WordPress is connected." });
  }
  if (input.connectedWriter === "shopify") {
    shopify += 3;
    signals.push({ id: "connected_shopify", evidence: "Shopify is connected." });
  }
  if (input.connectedWriter === "webhook") {
    app += 2;
    signals.push({ id: "connected_website", evidence: "Your own website is connected." });
  }

  const wpBody = input.wpJson?.body || "";
  if (input.wpJson?.status === 200) {
    try {
      const json = JSON.parse(wpBody) as { namespaces?: unknown; name?: unknown };
      if (Array.isArray(json.namespaces) || typeof json.name === "string") {
        wordpress += 4;
        signals.push({ id: "wp_json", evidence: "WordPress REST is reachable." });
      }
    } catch {
      /* not WP JSON */
    }
  }

  const home = input.homepage;
  const html = home?.body || "";
  const headerGet = (name: string): string => {
    if (!home) return "";
    if (home.headers instanceof Headers) return home.headers.get(name) || "";
    const key = Object.keys(home.headers).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? String(home.headers[key]) : "";
  };

  if (/x-shopify-stage|x-shopify-shop-id/i.test(headerGet("x-shopify-stage") + headerGet("x-shopify-shop-id"))) {
    shopify += 3;
    signals.push({ id: "shopify_header", evidence: "Shopify storefront headers were present." });
  }
  if (/cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i.test(html)) {
    shopify += 3;
    signals.push({ id: "shopify_html", evidence: "The homepage looks like a Shopify storefront." });
  }
  if (/<meta[^>]+content=["'][^"']*wordpress/i.test(html) || /\/wp-content\//i.test(html)) {
    wordpress += 2;
    signals.push({ id: "wp_html", evidence: "The homepage looks like WordPress." });
  }
  if (/__NEXT_DATA__|\/_next\/|vite|__NUXT__|astro/i.test(html)) {
    app += 2;
    signals.push({ id: "framework", evidence: "The homepage looks like a custom-coded site." });
  }
  if (/cdn\.sanity\.io|sanity\.io/i.test(html)) {
    sanity += 2;
    signals.push({ id: "sanity", evidence: "The homepage mentions Sanity." });
  }
  if (/github\.com|netlify|vercel|cloudflare pages/i.test(html)) {
    git += 1;
    signals.push({ id: "git_host", evidence: "The homepage mentions a git host." });
  }

  const scored = (
    [
      { kind: "wordpress" as const, n: wordpress },
      { kind: "shopify" as const, n: shopify },
      { kind: "application_database" as const, n: app },
      { kind: "git" as const, n: git },
      { kind: "sanity" as const, n: sanity },
    ] satisfies { kind: DetectedSourceOfTruth; n: number }[]
  ).sort((a, b) => b.n - a.n);

  const best = scored[0];
  if (!best || best.n === 0) {
    return { detected: "unknown", confidence: "low", signals };
  }

  // Framework / CMS fingerprints never auto-confirm and cap at medium.
  const frameworkOnly = best.kind === "git" || best.kind === "sanity" || (best.kind === "application_database" && wordpress === 0 && shopify === 0);
  let confidence: SourceConfidence = "low";
  if (best.n >= 6) confidence = "high";
  else if (best.n >= 3) confidence = "medium";
  if (frameworkOnly && confidence === "high") confidence = "medium";
  if (best.kind === "git" || best.kind === "sanity") confidence = "low";

  return { detected: best.kind, confidence, signals };
}

export async function probeSourceOfTruth(
  siteUrl: string,
  connectedWriter?: SitePlatform | null
): Promise<ProbeResult> {
  const origin = originOf(siteUrl);
  if (!origin) {
    return {
      detected: connectedWriter === "wordpress"
        ? "wordpress"
        : connectedWriter === "shopify"
          ? "shopify"
          : connectedWriter === "webhook"
            ? "application_database"
            : "unknown",
      confidence: connectedWriter ? "medium" : "low",
      signals: connectedWriter
        ? [{ id: "connected", evidence: "A website connection is already saved." }]
        : [],
    };
  }

  const [homepage, wpJson] = await Promise.all([
    fetchText(origin + "/"),
    fetchText(origin + "/wp-json"),
  ]);

  return scoreSourceSignals({
    connectedWriter,
    homepage: homepage
      ? { status: homepage.status, headers: homepage.headers, body: homepage.body }
      : null,
    wpJson: wpJson ? { status: wpJson.status, body: wpJson.body } : null,
  });
}

export async function detectAndStoreSourceOfTruth(
  brandId: string,
  siteUrl: string,
  connectedWriter?: SitePlatform | null
): Promise<SourceOfTruth> {
  const probe = await probeSourceOfTruth(siteUrl, connectedWriter);
  const brand = await getBrandById(brandId).catch(() => null);
  const current = parseSourceOfTruth(brand?.source_of_truth);
  const sameWriter =
    !!current.confirmed &&
    current.confirmed !== "unknown" &&
    writerForConfirmed(current.confirmed) === (connectedWriter || null);

  // Reconnect of the same platform keeps the human confirmation. Switching
  // writers clears it so Prove cannot run against the wrong Source of Truth.
  const stored: SourceOfTruth = {
    detected: probe.detected,
    confidence: probe.confidence,
    signals: probe.signals,
    detected_at: new Date().toISOString(),
    confirmed: sameWriter ? current.confirmed : null,
    confirmed_at: sameWriter ? current.confirmed_at : null,
  };
  await persistSourceOfTruth(brandId, stored);
  // Credentials may have changed even on the same writer — require Prove again.
  if (sameWriter) await markCertifiedOperationsStale(brandId);
  else if (current.confirmed) await markCertifiedOperationsStale(brandId);
  return stored;
}
