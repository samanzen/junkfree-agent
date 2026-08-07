// Every Google product the platform can connect, declared in one place.
//
// This is the extension point. Adding Google Ads, Tag Manager, Merchant Center
// or YouTube means adding ONE entry here plus a `listResources` implementation
// — no OAuth code, no new routes, no storage change, no UI change. That is the
// whole point of the shared layer.
//
// A product declares:
//   scopes        what to ask Google for
//   resourceNoun  what the customer is choosing, in their words
//   listResources how to enumerate what they can choose from

import { accessTokenFor } from "./tokens";

export type GoogleProductKey = "search_console" | "google_analytics" | "google_business_profile";

/** Something a customer picks after signing in: a site, a property, a location. */
export type GoogleResource = {
  id: string;
  label: string;
  /** Secondary line, e.g. "Full access" or a street address. */
  detail: string | null;
};

export type GoogleProduct = {
  key: GoogleProductKey;
  /** Customer-facing name. Never an API name. */
  name: string;
  /** What this connection gives the customer, in their language. */
  purpose: string;
  scopes: string[];
  resourceNoun: string;
  listResources: (accessToken: string) => Promise<GoogleResource[]>;
};

// ── Search Console ──────────────────────────────────────────────────────────
async function listSearchConsoleSites(accessToken: string): Promise<GoogleResource[]> {
  const res = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`sites.list ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] };
  return (data.siteEntry || [])
    .filter((s) => s.permissionLevel !== "siteUnverifiedUser")
    .map((s) => ({
      id: s.siteUrl,
      // "sc-domain:junkfree.ca" is how Google names it; customers know it as
      // their website.
      label: s.siteUrl.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
      detail: s.permissionLevel === "siteFullUser" ? "Full access" : "Limited access",
    }));
}

// ── Google Analytics (GA4) ──────────────────────────────────────────────────
async function listAnalyticsProperties(accessToken: string): Promise<GoogleResource[]> {
  // The Admin API lists properties; the Data API reads them. Both are enabled
  // on the project. accountSummaries returns accounts and their properties in
  // one call, which avoids an N+1 walk over accounts.
  const res = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`accountSummaries ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    accountSummaries?: {
      displayName?: string;
      propertySummaries?: { property?: string; displayName?: string }[];
    }[];
  };
  const out: GoogleResource[] = [];
  for (const a of data.accountSummaries || []) {
    for (const p of a.propertySummaries || []) {
      if (!p.property) continue;
      out.push({
        id: p.property, // "properties/123456789"
        label: p.displayName || p.property,
        detail: a.displayName || null,
      });
    }
  }
  return out;
}

// ── Google Business Profile ─────────────────────────────────────────────────
async function listBusinessLocations(accessToken: string): Promise<GoogleResource[]> {
  // Accounts first, then locations under each. Both APIs sit at 0 quota until
  // Google approves the project's access application, so this throws 429 until
  // then — surfaced to the customer as "not available yet", never as a stack
  // trace. See lib/connections.ts.
  const accRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!accRes.ok) throw new Error(`accounts ${accRes.status}: ${await accRes.text()}`);
  const accounts = ((await accRes.json()) as { accounts?: { name?: string; accountName?: string }[] }).accounts || [];

  const out: GoogleResource[] = [];
  for (const acc of accounts) {
    if (!acc.name) continue;
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations` +
        `?readMask=name,title,storefrontAddress&pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!locRes.ok) continue; // one unreadable account must not hide the rest
    const locs = ((await locRes.json()) as {
      locations?: { name?: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string } }[];
    }).locations || [];
    for (const l of locs) {
      if (!l.name) continue;
      const addr = [l.storefrontAddress?.addressLines?.[0], l.storefrontAddress?.locality]
        .filter(Boolean)
        .join(", ");
      out.push({
        id: l.name,
        label: l.title || l.name,
        detail: addr || acc.accountName || null,
      });
    }
  }
  return out;
}

export const GOOGLE_PRODUCTS: Record<GoogleProductKey, GoogleProduct> = {
  search_console: {
    key: "search_console",
    name: "Google Search Console",
    purpose: "Your keyword rankings, clicks and impressions come from here.",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    resourceNoun: "website",
    listResources: listSearchConsoleSites,
  },
  google_analytics: {
    key: "google_analytics",
    name: "Google Analytics",
    purpose: "What visitors do once they reach your site, and which searches turn into enquiries.",
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    resourceNoun: "property",
    listResources: listAnalyticsProperties,
  },
  google_business_profile: {
    key: "google_business_profile",
    name: "Google Business Profile",
    purpose: "Your position in the local map results, how people find you, and your reviews.",
    scopes: ["https://www.googleapis.com/auth/business.manage"],
    resourceNoun: "location",
    listResources: listBusinessLocations,
  },
};

export const GOOGLE_PRODUCT_KEYS = Object.keys(GOOGLE_PRODUCTS) as GoogleProductKey[];

export function isGoogleProduct(key: string): key is GoogleProductKey {
  return key in GOOGLE_PRODUCTS;
}

/** Resources a customer can choose for a product, using their linked account. */
export async function listResourcesFor(
  brandId: string,
  product: GoogleProductKey,
  accountId: string
): Promise<GoogleResource[]> {
  const token = await accessTokenFor(brandId, accountId);
  return GOOGLE_PRODUCTS[product].listResources(token);
}
