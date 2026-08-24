/**
 * Website Connection view model — one brand site → one connection →
 * adapter + capabilities + verification. Built from existing brand /
 * site_capabilities / primary_writer / proxy_* fields without a new schema.
 */

import type { Brand } from "../brands";
import type { AdapterCapability } from "../execution/types";
import {
  capabilityMapForWriter,
  executionGrade,
  parseCapabilityMap,
  type OperationState,
  type SiteCapabilityMap,
} from "../execution/site-capabilities";
import { isSitePlatform } from "../execution/registry";
import { parseSourceOfTruth } from "../execution/source-of-truth";
import {
  CAPABILITY_LABELS,
  CUSTOMER_CAPABILITY_ORDER,
  DEFAULT_MANAGED_NAMESPACE,
  statusLabelFor,
  type CapabilityAvailability,
  type CapabilityView,
  type WebsiteAdapterId,
  type WebsiteCapability,
} from "./capabilities";

export type WebsiteConnectionView = {
  /** Customer-facing connection title. */
  name: string;
  purpose: string;
  siteUrl: string | null;
  siteHost: string | null;
  /** Connected | limited (needs proof) | not connected | … — mirrors ConnectionStatus. */
  connected: boolean;
  grade: "none" | "transport" | "partial" | "full";
  /** Active adapter under the hood. */
  adapterId: WebsiteAdapterId | null;
  /** Advanced-only label (WordPress, Shopify, Volo Managed Pages, …). */
  adapterLabel: string | null;
  managedNamespace: string | null;
  capabilities: CapabilityView[];
  /** Technical diagnostics for Advanced. */
  advanced: {
    adapter: string | null;
    publishingMethod: string | null;
    verification: string;
    managedPath: string | null;
    primaryWriter: string | null;
  };
};

function hostOf(siteUrl: string | null | undefined): string | null {
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).host;
  } catch {
    return siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") || null;
  }
}

function opAvailability(
  state: OperationState | undefined,
  certifying: boolean
): CapabilityAvailability {
  if (!state || state === "unsupported") return "unavailable";
  if (certifying && state !== "certified") return "needs_proof";
  if (state === "certified") return "available";
  if (state === "supported_unverified" || state === "stale" || state === "temporarily_failed") {
    return "needs_proof";
  }
  if (state === "revoked") return "not_configured";
  return "unavailable";
}

function adapterFromWriter(writer: string | null): {
  id: WebsiteAdapterId;
  label: string;
  method: string;
} | null {
  if (writer === "proxy") {
    return {
      id: "managed_pages",
      label: "Volo Managed Pages",
      method: "Managed pages on your domain",
    };
  }
  if (writer === "wordpress") {
    return { id: "wordpress", label: "WordPress", method: "Native WordPress pages and posts" };
  }
  if (writer === "shopify") {
    return { id: "shopify", label: "Shopify", method: "Native Shopify pages" };
  }
  if (writer === "webhook") {
    return {
      id: "webhook",
      label: "Custom-coded site",
      method: "Signed publish receiver on your site",
    };
  }
  if (writer === "github") {
    return {
      id: "github",
      label: "GitHub",
      method: "Pull requests to your repository (never silent production edits)",
    };
  }
  if (writer === "sanity") {
    return { id: "sanity", label: "Sanity", method: "Sanity Content Lake documents" };
  }
  return null;
}

function mapOp(
  map: SiteCapabilityMap,
  op: AdapterCapability,
  certifying: boolean
): CapabilityAvailability {
  return opAvailability(map[op]?.state, certifying);
}

/**
 * Derive customer-facing capabilities from the honesty map + adapter.
 * Content-strategy choices (blog vs guide) stay out of this layer — we only
 * report what the connection can do.
 */
export function capabilitiesForConnection(opts: {
  adapterId: WebsiteAdapterId | null;
  map: SiteCapabilityMap;
  certifying: boolean;
  connected: boolean;
}): CapabilityView[] {
  const { adapterId, map, certifying, connected } = opts;
  const page = mapOp(map, "upsert_page", certifying);
  const meta = mapOp(map, "update_meta", certifying);

  const byKey: Record<WebsiteCapability, CapabilityAvailability> = {
    read_site: connected ? "available" : "not_configured",
    create_page: page,
    update_page:
      adapterId === "managed_pages"
        ? "unavailable"
        : page === "available"
          ? "available"
          : page === "needs_proof"
            ? "needs_proof"
            : "not_configured",
    create_blog_post:
      adapterId === "wordpress" || adapterId === "github"
        ? page
        : "not_configured",
    update_blog_post:
      adapterId === "wordpress" || adapterId === "github" ? page : "not_configured",
    update_meta:
      meta === "unavailable"
        ? adapterId === "shopify" || adapterId === "managed_pages" || adapterId === "webhook"
          ? "unavailable"
          : adapterId
            ? "not_configured"
            : "not_configured"
        : meta,
    update_schema: "not_configured",
    manage_internal_links: "not_configured",
    manage_redirects: "not_configured",
    manage_sitemap: adapterId === "managed_pages" && page === "available" ? "available" : "not_configured",
    upload_media: "not_configured",
    rollback: "not_configured",
    managed_pages:
      adapterId === "managed_pages"
        ? page
        : "not_configured",
  };

  return CUSTOMER_CAPABILITY_ORDER.map((key) => ({
    key,
    label: CAPABILITY_LABELS[key],
    status: byKey[key],
    statusLabel: statusLabelFor(byKey[key]),
  }));
}

/**
 * Build the Website Connection view for a brand from existing columns.
 * No migration required — proxy stays primary_writer="proxy" internally.
 */
export function describeWebsiteConnection(
  brand: Brand,
  opts?: { certifying?: boolean; hasPublisher?: boolean }
): WebsiteConnectionView {
  const certifying = !!opts?.certifying;
  const pinned =
    brand.primary_writer && isSitePlatform(brand.primary_writer)
      ? brand.primary_writer
      : null;
  const sot = parseSourceOfTruth(brand.source_of_truth);
  const proxyPending =
    !!brand.proxy_site_token &&
    !!brand.proxy_namespace &&
    sot.confirmed === "platform_proxy";
  const proxyActive = pinned === "proxy" || (proxyPending && !pinned);

  let writer = pinned;
  if (proxyActive) writer = "proxy";
  if (!writer && !opts?.hasPublisher) {
    return {
      name: "Website connection",
      purpose: "Connect your website so Volo can read it and publish approved work where it fits.",
      siteUrl: brand.site_url || null,
      siteHost: hostOf(brand.site_url),
      connected: false,
      grade: "none",
      adapterId: null,
      adapterLabel: null,
      managedNamespace: null,
      capabilities: capabilitiesForConnection({
        adapterId: null,
        map: {},
        certifying: false,
        connected: false,
      }),
      advanced: {
        adapter: null,
        publishingMethod: null,
        verification: "Not connected",
        managedPath: null,
        primaryWriter: null,
      },
    };
  }

  const adapter = adapterFromWriter(writer);
  const stored = parseCapabilityMap(brand.site_capabilities);
  const map =
    Object.keys(stored).length && writer
      ? stored
      : writer
        ? capabilityMapForWriter(writer)
        : {};
  const grade = executionGrade(map, true);
  const connected = grade === "full" || grade === "partial" || grade === "transport";
  const ns =
    writer === "proxy"
      ? brand.proxy_namespace || DEFAULT_MANAGED_NAMESPACE
      : null;

  const verification =
    grade === "full"
      ? "Proven on your live site"
      : grade === "partial"
        ? "Partially proven"
        : grade === "transport"
          ? "Reachable — publishing not proven yet"
          : "Not verified";

  return {
    name: "Website connection",
    purpose: "Volo’s overall ability to work with your website — reading, publishing, and managed pages.",
    siteUrl: brand.site_url || null,
    siteHost: hostOf(brand.site_url),
    connected: grade === "full",
    grade,
    adapterId: adapter?.id || null,
    adapterLabel: adapter?.label || null,
    managedNamespace: ns,
    capabilities: capabilitiesForConnection({
      adapterId: adapter?.id || null,
      map,
      certifying,
      connected,
    }),
    advanced: {
      adapter: adapter?.id || null,
      publishingMethod: adapter?.method || null,
      verification,
      managedPath: ns ? `/${ns}/` : null,
      primaryWriter: writer,
    },
  };
}
