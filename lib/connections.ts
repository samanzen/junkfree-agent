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
import { googleConfigured } from "./google/oauth";
import { readGoogle, type GoogleMetadata } from "./google/store";
import { accessTokenFor } from "./google/tokens";
import { GOOGLE_PRODUCTS, type GoogleProductKey } from "./google/registry";

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
  /**
   * Why the status is what it is, in the customer's language. Never empty —
   * see rule 1 above, and never a raw error string: see `lastError` below.
   */
  why: string;
  /** The connected account as a person would recognise it, e.g. "junkfree.ca". */
  detail: string | null;
  /** ISO timestamp of the last successful sync we can evidence, or null. */
  lastSyncAt: string | null;
  /** Human phrasing of data freshness, e.g. "Search Console data through Aug 4". */
  lastSyncLabel: string | null;
  /**
   * Diagnostic detail for the server log ONLY — never rendered.
   *
   * This holds raw provider and database errors ("42501: permission denied for
   * table brand_integrations"). Showing that to a customer turns the page into
   * an internal dashboard, so the route strips this field before responding
   * and the customer sees `why` instead. Kept on the type so the diagnosis
   * still reaches the log rather than being thrown away.
   */
  lastError: string | null;
  /** Actions the UI should offer. Empty for unavailable services. */
  actions: ConnectionAction[];
  /** Selectable accounts/properties when more than one exists. */
  accounts: ConnectionAccount[] | null;
  /**
   * The customer has signed in but has not yet chosen what to use.
   *
   * Exists because the UI previously inferred this from a URL parameter that
   * it deleted moments later, so the picker vanished on the next render and
   * the card said "choose which location to use" with nothing to choose from.
   * Making it part of the state means the picker is driven by the connection
   * itself and survives a refresh.
   */
  awaitingChoice?: boolean;
  /** For `unavailable` only: exactly what it would take to enable this. */
  requirement: string | null;
};

/**
 * What the customer receives. `lastError` is removed here rather than in the
 * route so that no future caller can leak it by forgetting to strip it.
 */
export type PublicConnectionState = Omit<ConnectionState, "lastError">;

/** Strip diagnostics, logging them first so the detail is not simply lost. */
export function toPublic(states: ConnectionState[], brandSlug: string): PublicConnectionState[] {
  return states.map(({ lastError, ...rest }) => {
    if (lastError) {
      console.warn(`[connections] ${brandSlug}/${rest.key} (${rest.status}): ${lastError}`);
    }
    return rest;
  });
}

export type ConnectionKey =
  | "search_console"
  | "google_business_profile"
  | "google_analytics"
  | "keyword_data"
  | "website_publishing";

/** Services whose state we can genuinely act on. */
export const ACTIONABLE_KEYS: ConnectionKey[] = ["search_console", "website_publishing"];

/** Search Console property ids look like "sc-domain:junkfree.ca". Show the
 *  part a person recognises as their website. */
const siteLabel = (p: string) =>
  p.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Signals that the legacy administrator-shared picker should be skipped in
 *  favour of customer sign-in. Not an error condition. */
class SkipLegacyPicker extends Error {}

const fmtDate = (iso: string) =>
  new Date(iso + (iso.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-CA", {
    month: "short", day: "numeric", timeZone: "UTC",
  });

/**
 * Search Console.
 *
 * Two auth paths coexist here, deliberately:
 *
 *   Customer sign-in (lib/google/*) is the route offered whenever the platform
 *   has Google credentials configured. The customer approves access at Google
 *   and picks their own property.
 *
 *   A shared service account, which an administrator adds to a property, was
 *   the only path before OAuth existed. It still reads data in lib/gsc.ts, so
 *   brands set up that way keep working with no migration. It is only hidden
 *   from the picker, so a customer is never shown two ways to do one thing.
 *
 * This describer is separate from googleProduct() below because it alone has a
 * data-freshness signal and the legacy fallback to reason about.
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
    // Once customers can sign in with Google, that is the only way to connect
    // this — offering the administrator-shared list as a second picker would
    // mean two different routes to the same setting on one card.
    //
    // The service account itself is NOT retired: lib/gsc.ts still reads data
    // through it, so every brand connected that way keeps working untouched.
    // What changes here is only which choices the customer is offered.
    if (googleConfigured()) throw new SkipLegacyPicker();
    const props = await listProperties();
    accounts = props.map((p) => ({
      id: p.siteUrl,
      label: siteLabel(p.siteUrl),
      // Google's own wording here is "siteFullUser" / "siteRestrictedUser",
      // which means nothing to a customer choosing their website.
      detail: p.permissionLevel === "siteFullUser" ? "Full access" : "Limited access",
    }));
  } catch (e) {
    // A skipped legacy picker simply means "no legacy choices", not a fault.
    if (!(e instanceof SkipLegacyPicker)) listError = e instanceof Error ? e.message : String(e);
  }

  // Nothing selected yet.
  if (!brand.gsc_property) {
    if (listError) {
      return {
        ...base, status: "error", detail: null, accounts: null,
        why: "We couldn't reach Google Search Console just now, so we can't show which websites are available to link.",
        lastSyncAt: null, lastSyncLabel: null, lastError: listError,
        actions: ["reconnect"], requirement: null,
      };
    }
    if (!accounts?.length) {
      return {
        ...base, status: "not_connected", detail: null, accounts: [],
        why: googleConfigured()
          ? "Sign in with Google to bring your rankings, clicks and impressions through."
          : "No website has been shared with us yet. Your account manager sets this up — it only takes a moment.",
        lastSyncAt: null, lastSyncLabel: null,
        actions: ["connect"], requirement: null,
      };
    }
    return {
      ...base, status: "not_connected", detail: null, accounts,
      why: `${accounts.length} website${accounts.length === 1 ? " is" : "s are"} ready to link, but none is connected to this account yet. Choose one below.`,
      lastSyncAt: null, lastSyncLabel: null,
      actions: ["connect"], requirement: null,
    };
  }

  // A property is selected — verify we can actually still read it.
  const selected = brand.gsc_property;
  const stillGranted = accounts ? accounts.some((a) => a.id === selected) : null;

  if (stillGranted === false) {
    return {
      ...base, status: "expired", detail: siteLabel(selected), accounts,
      why: "Google has stopped sharing this website's search data with us, so your rankings and traffic figures are no longer updating.",
      lastSyncAt: null, lastSyncLabel: null,
      lastError: "Access to this property was removed.",
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
      ...base, status: "error", detail: siteLabel(selected), accounts,
      why: "This website is linked, but we couldn't read its latest search data. This is usually temporary.",
      lastSyncAt: null, lastSyncLabel: null, lastError: freshErr,
      actions: ["reconnect", "sync_now", "disconnect"], requirement: null,
    };
  }

  const lastJob = await lastSuccessfulSync(brand.id, ["rank_sync", "performance"]);

  return {
    ...base,
    status: "connected",
    detail: siteLabel(selected),
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
      why: "We can't check your website connection right now. This is on our side — please try again shortly.",
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
      ? "Included with your plan and running — nothing for you to connect."
      : "Your search volume and difficulty figures are temporarily unavailable.",
    detail: configured ? "Included with your plan" : null,
    lastSyncAt: lastSync,
    lastSyncLabel: lastSync ? `Last refreshed ${fmtDate(lastSync.slice(0, 10))}` : "Not refreshed yet",
    lastError: configured ? null : "Ranking data provider not configured.",
    actions: configured ? ["sync_now"] : [],
    accounts: null,
    requirement: configured ? null : "Your ranking data is briefly unavailable. Our team has been notified and is restoring it — nothing is needed from you.",
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

/**
 * Copy rule for anything a customer reads on this page.
 *
 * Say what the feature will do for their business and when it becomes
 * available. Never name the machinery: no OAuth, APIs, Google Cloud, client
 * IDs, service accounts, tables, endpoints or provider names. A customer
 * cannot act on any of that, and reading it makes a product feel like
 * somebody's internal tooling.
 *
 * Diagnostics still exist — they go to `lastError`, which is stripped by
 * toPublic() and written to the server log instead.
 */

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

  const [gbp, ga4] = await Promise.all([
    googleProduct(brand, "google_business_profile"),
    googleProduct(brand, "google_analytics"),
  ]);

  return [gsc, keywords, publishing, gbp, ga4];
}

/**
 * A Google product that connects through the shared sign-in.
 *
 * Search Console keeps its own describer above because it also has the
 * service-account path and a data-freshness signal; these two are pure OAuth.
 *
 * Business Profile is the interesting case: the customer can sign in
 * successfully and still have nothing to choose, because Google holds the
 * project at zero quota until it approves the access application. That is a
 * real state, not an error, and it is reported as "signed in, waiting on
 * Google" rather than as a failure the customer could fix.
 */
async function googleProduct(brand: Brand, key: GoogleProductKey): Promise<ConnectionState> {
  const product = GOOGLE_PRODUCTS[key];
  const base = {
    key,
    name: product.name,
    purpose: product.purpose,
    accounts: null as ConnectionAccount[] | null,
    requirement: null as string | null,
  };

  if (!googleConfigured()) {
    return {
      ...base, status: "unavailable",
      why: `Connecting ${product.name} isn't available yet.`,
      detail: null, lastSyncAt: null, lastSyncLabel: null, lastError: null,
      actions: [],
      requirement: "We're finishing this connection off. We'll let you know the moment you can link it.",
    };
  }

  const google: GoogleMetadata = await readGoogle(brand.id).catch(() => ({ accounts: [], selections: {} }));
  const selection = google.selections[key];

  // Nothing linked yet.
  if (!selection) {
    const signedIn = google.accounts.length > 0;
    return {
      ...base, status: "not_connected",
      why: signedIn
        ? `You're signed in to Google — choose which ${product.resourceNoun} to use.`
        : `Connect your Google account to bring in ${product.name.replace("Google ", "").toLowerCase()} data.`,
      detail: null, lastSyncAt: null, lastSyncLabel: null, lastError: null,
      // Signed in but nothing chosen: the portal must show the picker, and
      // must keep showing it on a refresh. Saying so here is what makes that
      // independent of how the customer arrived on the page.
      awaitingChoice: signedIn,
      // Connect stays available even once signed in: it is how a customer
      // signs in with a DIFFERENT Google account, which is exactly what the
      // picker's empty state tells them to do when an account has nothing to
      // offer. Removing it would make that advice impossible to follow.
      actions: ["connect"],
    };
  }

  const account = google.accounts.find((a) => a.id === selection.accountId);
  if (!account) {
    // A selection pointing at an account that is gone — recoverable by
    // connecting again, so say that rather than showing a broken state.
    return {
      ...base, status: "expired",
      why: "This connection needs to be set up again.",
      detail: selection.label, lastSyncAt: null, lastSyncLabel: null,
      lastError: `Selection references missing account ${selection.accountId}.`,
      actions: ["reconnect", "disconnect"],
    };
  }

  // Confirm the stored access still works. This is what turns "we saved a
  // token once" into a real health check.
  let healthy = true;
  let failure: string | null = null;
  try {
    await accessTokenFor(brand.id, selection.accountId);
  } catch (e) {
    healthy = false;
    failure = e instanceof Error ? e.message : String(e);
  }

  if (!healthy) {
    return {
      ...base, status: "expired",
      why: "Google is asking you to sign in again to keep this connected.",
      detail: selection.label, lastSyncAt: null, lastSyncLabel: null, lastError: failure,
      actions: ["reconnect", "disconnect"],
    };
  }

  return {
    ...base,
    status: "connected",
    why: `Connected as ${account.email}.`,
    detail: selection.label,
    lastSyncAt: selection.selectedAt,
    lastSyncLabel: `Connected ${fmtDate(selection.selectedAt.slice(0, 10))}`,
    lastError: null,
    actions: ["reconnect", "disconnect"],
  };
}
