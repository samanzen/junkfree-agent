// THE INTEGRATION CENTER MODEL — one description of every service the
// platform can connect to, what state it is in for a given brand, and what the
// customer can do about it.
//
// Why this file exists: the Connections tab used to derive two booleans from
// brand columns and render "Connected"/"Not connected". It could not say when
// data last arrived, could not act, and could not explain anything. Rather
// than scatter that logic across the UI, every connection is described here
// and the page renders what it is told.
//
// Two rules are enforced by the types rather than by convention:
//
//   1. Every state carries a `why`. There is no way to construct a connection
//      state without a human-readable reason, so the UI cannot render a bare
//      "Not connected" or an unexplained dash.
//   2. Availability is explicit. A service the platform genuinely cannot
//      connect to yet is `unavailable` and MUST carry `requirement` — what it
//      would actually take. That is what keeps a card from being a dead end.
//
// Reuse: credential storage is lib/integrations.ts, publishing adapters are
// lib/execution/*, job dispatch is lib/queue.ts. Nothing is reimplemented here.

import type { Brand } from "./brands";
import { listProperties, latestDataDate } from "./gsc";
import { isConfigured as dataForSeoConfigured } from "./dataforseo";
import { listIntegrations, integrationsReachable } from "./integrations";
import { describeAdapters } from "./execution/registry";
import { db } from "./supabase";

export type ConnectionStatus =
  | "connected"
  | "not_connected"
  | "expired"
  | "error"
  /** The platform has no integration for this service yet. Must explain what is required. */
  | "unavailable";

export type ConnectionAction = "connect" | "disconnect" | "reconnect" | "sync_now";

export type ConnectionAccount = {
  id: string;
  label: string;
  detail: string | null;
};

export type ConnectionState = {
  key: ConnectionKey;
  name: string;
  purpose: string;
  status: ConnectionStatus;
  /** Why the status is what it is. Never empty — see rule 1 above. */
  why: string;
  /** The connected identifier (a GSC property, a site URL), when there is one. */
  detail: string | null;
  /** ISO timestamp of the last successful sync we can evidence, or null. */
  lastSyncAt: string | null;
  /** Human phrasing of data freshness, e.g. "Search Console data through Aug 4". */
  lastSyncLabel: string | null;
  lastError: string | null;
  /** Actions the UI should offer. Empty for unavailable services. */
  actions: ConnectionAction[];
  /** Selectable accounts/properties when more than one exists. */
  accounts: ConnectionAccount[] | null;
  /** For `unavailable` only: exactly what it would take to enable this. */
  requirement: string | null;
};

export type ConnectionKey =
  | "search_console"
  | "google_business_profile"
  | "google_analytics"
  | "keyword_data"
  | "website_publishing";

/** Services whose state we can genuinely act on. */
export const ACTIONABLE_KEYS: ConnectionKey[] = ["search_console", "website_publishing"];

const fmtDate = (iso: string) =>
  new Date(iso + (iso.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-CA", {
    month: "short", day: "numeric", timeZone: "UTC",
  });

/**
 * Search Console.
 *
 * Auth is a shared service account the customer grants access to their
 * property, so "connect" is: confirm we can read it, then record which
 * property. There is no OAuth redirect and it would be dishonest to imply one.
 */
async function searchConsole(brand: Brand): Promise<ConnectionState> {
  const base = {
    key: "search_console" as const,
    name: "Google Search Console",
    purpose: "Your keyword rankings, clicks and impressions come from here.",
    lastError: null as string | null,
  };

  let accounts: ConnectionAccount[] | null = null;
  let listError: string | null = null;
  try {
    const props = await listProperties();
    accounts = props.map((p) => ({
      id: p.siteUrl,
      label: p.siteUrl.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
      detail: p.permissionLevel === "siteFullUser" ? "Full access" : p.permissionLevel,
    }));
  } catch (e) {
    listError = e instanceof Error ? e.message : String(e);
  }

  // Nothing selected yet.
  if (!brand.gsc_property) {
    if (listError) {
      return {
        ...base, status: "error", detail: null, accounts: null,
        why: "We couldn't reach Search Console to see which properties we can read.",
        lastSyncAt: null, lastSyncLabel: null, lastError: listError,
        actions: ["reconnect"], requirement: null,
      };
    }
    if (!accounts?.length) {
      return {
        ...base, status: "not_connected", detail: null, accounts: [],
        why: "Search Console hasn't granted us access to any property yet.",
        lastSyncAt: null, lastSyncLabel: null,
        actions: ["connect"], requirement: null,
      };
    }
    return {
      ...base, status: "not_connected", detail: null, accounts,
      why: `We can read ${accounts.length} propert${accounts.length === 1 ? "y" : "ies"}, but none is linked to this account yet.`,
      lastSyncAt: null, lastSyncLabel: null,
      actions: ["connect"], requirement: null,
    };
  }

  // A property is selected — verify we can actually still read it.
  const selected = brand.gsc_property;
  const stillGranted = accounts ? accounts.some((a) => a.id === selected) : null;

  if (stillGranted === false) {
    return {
      ...base, status: "expired", detail: selected, accounts,
      why: "Our access to this property was removed in Search Console, so new data has stopped arriving.",
      lastSyncAt: null, lastSyncLabel: null,
      lastError: "Service account no longer listed on this property.",
      actions: ["reconnect", "disconnect"], requirement: null,
    };
  }

  let freshness: string | null = null;
  let freshErr: string | null = null;
  try {
    freshness = await latestDataDate(selected);
  } catch (e) {
    freshErr = e instanceof Error ? e.message : String(e);
  }

  if (freshErr) {
    return {
      ...base, status: "error", detail: selected, accounts,
      why: "The property is linked, but the last attempt to read its data failed.",
      lastSyncAt: null, lastSyncLabel: null, lastError: freshErr,
      actions: ["reconnect", "sync_now", "disconnect"], requirement: null,
    };
  }

  const lastJob = await lastSuccessfulSync(brand.id, ["rank_sync", "performance"]);

  return {
    ...base,
    status: "connected",
    detail: selected,
    accounts,
    why: freshness
      ? "Connected and receiving data."
      : "Connected, but this property has no search data in the last 28 days.",
    lastSyncAt: lastJob,
    lastSyncLabel: freshness
      // Search Console lags ~2 days; saying "synced 5 min ago" would overstate
      // how current the numbers actually are.
      ? `Search Console data through ${fmtDate(freshness)}`
      : "No data in the last 28 days",
    actions: ["sync_now", "reconnect", "disconnect"],
    requirement: null,
  };
}

/** The most recent successfully finished job of the given kinds. */
async function lastSuccessfulSync(brandId: string, kinds: string[]): Promise<string | null> {
  const { data } = await db
    .from("jobs")
    .select("finished_at")
    .eq("brand_id", brandId)
    .in("kind", kinds)
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(1);
  return (data as { finished_at: string | null }[] | null)?.[0]?.finished_at || null;
}

/**
 * Website publishing (WordPress / webhook).
 *
 * Credentials live in brand_integrations and the adapters already exist in
 * lib/execution. This reports their state; the live credential check stays in
 * /api/execution, which already does it, rather than being duplicated here.
 */
async function websitePublishing(brand: Brand): Promise<ConnectionState> {
  const base = {
    key: "website_publishing" as const,
    name: "Website publishing",
    purpose: "Lets approved content and meta fixes be published straight to your site.",
    accounts: null,
    requirement: null,
  };

  const reach = await integrationsReachable();
  if (!reach.ok) {
    return {
      ...base, status: "error", detail: null,
      why: "The integrations table can't be read, so we can't tell what's connected.",
      lastSyncAt: null, lastSyncLabel: null, lastError: reach.reason,
      actions: ["reconnect"],
    };
  }

  const rows = await listIntegrations(brand.id).catch(() => []);
  const publishable = new Set<string>(describeAdapters().map((a) => a.provider));
  const active = rows.find((r) => publishable.has(r.provider) && r.status === "connected");

  if (!active) {
    const errored = rows.find((r) => publishable.has(r.provider) && r.status === "error");
    if (errored) {
      return {
        ...base, status: "error", detail: errored.provider,
        why: "The last publish attempt to your site failed, so publishing is paused.",
        lastSyncAt: errored.last_connected_at, lastSyncLabel: null,
        lastError: errored.last_error,
        actions: ["reconnect", "disconnect"],
      };
    }
    return {
      ...base, status: "not_connected", detail: null,
      why: "No website connection yet, so approved work has to be published by hand.",
      lastSyncAt: null, lastSyncLabel: null, lastError: null,
      actions: ["connect"],
    };
  }

  const lastPublish = await lastSuccessfulSync(brand.id, ["publish"]);
  return {
    ...base,
    status: "connected",
    detail: active.provider,
    why: "Connected — approved changes can be published to your site.",
    lastSyncAt: lastPublish || active.last_connected_at,
    lastSyncLabel: lastPublish ? `Last publish ${fmtDate(lastPublish.slice(0, 10))}` : "Nothing published yet",
    lastError: null,
    actions: ["sync_now", "reconnect", "disconnect"],
  };
}

/**
 * Keyword and ranking data (DataForSEO).
 *
 * Platform-level credentials shared by every brand, not something a customer
 * connects or disconnects — so it reports status and nothing else. Offering a
 * disconnect button here would imply per-customer control that doesn't exist.
 */
async function keywordData(brand: Brand): Promise<ConnectionState> {
  const configured = dataForSeoConfigured();
  const lastSync = await lastSuccessfulSync(brand.id, ["rank_sync", "rank_enrich"]);
  return {
    key: "keyword_data",
    name: "Keyword & ranking data",
    purpose: "Search volume, keyword difficulty and competitor rankings.",
    status: configured ? "connected" : "error",
    why: configured
      ? "Included with your plan and active — nothing for you to connect."
      : "The platform's ranking data provider isn't configured, so volume and difficulty are unavailable.",
    detail: configured ? "Included with your plan" : null,
    lastSyncAt: lastSync,
    lastSyncLabel: lastSync ? `Last refreshed ${fmtDate(lastSync.slice(0, 10))}` : "Not refreshed yet",
    lastError: configured ? null : "DATAFORSEO credentials are not set on the server.",
    actions: configured ? ["sync_now"] : [],
    accounts: null,
    requirement: configured ? null : "A platform administrator needs to set the ranking data credentials.",
  };
}

/**
 * Services with no integration built yet.
 *
 * These are deliberately NOT rendered as connectable. The platform has no API
 * client, no stored credentials and no OAuth application for either one, so a
 * "Connect" button could not do anything — which is precisely the dead end
 * this work exists to remove. Each states what it would actually take.
 */
function unavailable(
  key: ConnectionKey, name: string, purpose: string, why: string, requirement: string
): ConnectionState {
  return {
    key, name, purpose, status: "unavailable", why,
    detail: null, lastSyncAt: null, lastSyncLabel: null, lastError: null,
    actions: [], accounts: null, requirement,
  };
}

/** Every connection for a brand, with live status. */
export async function describeConnections(brand: Brand): Promise<ConnectionState[]> {
  const [gsc, publishing, keywords] = await Promise.all([
    searchConsole(brand).catch((e): ConnectionState => ({
      key: "search_console", name: "Google Search Console",
      purpose: "Your keyword rankings, clicks and impressions come from here.",
      status: "error", why: "We couldn't check this connection just now.",
      detail: brand.gsc_property, lastSyncAt: null, lastSyncLabel: null,
      lastError: e instanceof Error ? e.message : String(e),
      actions: ["reconnect"], accounts: null, requirement: null,
    })),
    websitePublishing(brand).catch((e): ConnectionState => ({
      key: "website_publishing", name: "Website publishing",
      purpose: "Lets approved content and meta fixes be published straight to your site.",
      status: "error", why: "We couldn't check this connection just now.",
      detail: null, lastSyncAt: null, lastSyncLabel: null,
      lastError: e instanceof Error ? e.message : String(e),
      actions: ["reconnect"], accounts: null, requirement: null,
    })),
    keywordData(brand),
  ]);

  return [
    gsc,
    keywords,
    publishing,
    unavailable(
      "google_business_profile",
      "Google Business Profile",
      "Would add map pack rankings, profile insights and review syncing.",
      brand.gbp_location_id
        ? "Your location ID is on file, but the platform has no Business Profile connection to read it with yet."
        : "The platform can't connect to Business Profile yet, so map pack data and reviews aren't available.",
      "Requires a Google Cloud OAuth application with the Business Profile API enabled and a verified consent screen. Your account manager can tell you when this is scheduled."
    ),
    unavailable(
      "google_analytics",
      "Google Analytics",
      "Would add on-site behaviour, conversions and lead attribution.",
      "The platform has no Analytics connection yet, so on-site behaviour and conversions aren't available.",
      "Requires a Google Cloud OAuth application with the Analytics Data API enabled. Your account manager can tell you when this is scheduled."
    ),
  ];
}
