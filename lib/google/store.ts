// Where linked Google accounts and product selections live.
//
// Storage shape, and why:
//
//   brand_integrations has `unique (brand_id, provider)`, so a brand can hold
//   exactly one row per provider. The requirement is multiple Google accounts
//   per brand. Rather than a migration (which needs SQL access this process
//   does not have, and migration 007 has been outstanding for a while), the
//   provider is a single "google" identity row and accounts live inside it:
//
//     credentials_encrypted -> { "refresh:<googleUserId>": "<refresh token>" }
//     metadata              -> { accounts: [...], selections: {...} }
//
//   The credential bag stays a flat Record<string,string>, which is exactly
//   what encryptCredentials() already accepts, so lib/integrations.ts and
//   lib/crypto.ts are reused unchanged — no new storage or crypto code.
//
//   This also matches the product design: one Google identity per brand, with
//   Search Console / GA4 / Business Profile each selecting a resource from it.
//   Adding Ads or YouTube adds a selection key, not a table.

import {
  getIntegration,
  getDecryptedCredentials,
  upsertIntegrationCredentials,
  disconnectIntegration,
} from "../integrations";
import type { GoogleProductKey } from "./registry";

const PROVIDER = "google" as const;
const REFRESH_PREFIX = "refresh:";

/** A Google account the customer has signed in with. */
export type LinkedAccount = {
  id: string;
  email: string;
  connectedAt: string;
  /** Scopes this account actually granted, so a product can tell if it may use it. */
  scopes: string[];
};

/** What a product is pointed at, e.g. a GSC property or a GA4 property. */
export type ProductSelection = {
  accountId: string;
  resourceId: string;
  /** Human label shown in the portal, e.g. "junkfree.ca". */
  label: string;
  selectedAt: string;
};

export type GoogleMetadata = {
  accounts: LinkedAccount[];
  selections: Partial<Record<GoogleProductKey, ProductSelection>>;
};

const EMPTY: GoogleMetadata = { accounts: [], selections: {} };

export async function readGoogle(brandId: string): Promise<GoogleMetadata> {
  const row = await getIntegration(brandId, PROVIDER).catch(() => null);
  if (!row) return EMPTY;
  const meta = (row.metadata || {}) as Partial<GoogleMetadata>;
  return { accounts: meta.accounts || [], selections: meta.selections || {} };
}

/** Refresh token for one linked account, or null if it isn't linked. */
export async function refreshTokenFor(brandId: string, accountId: string): Promise<string | null> {
  const creds = await getDecryptedCredentials(brandId, PROVIDER).catch(() => null);
  return creds?.[REFRESH_PREFIX + accountId] || null;
}

/**
 * Record a newly linked account, preserving every account already linked.
 *
 * upsertIntegrationCredentials replaces the whole credential bag, so existing
 * tokens are read first and merged. Dropping them would silently unlink every
 * other Google account the moment a second one was added.
 */
export async function linkAccount(
  brandId: string,
  account: { id: string; email: string; scopes: string[] },
  refreshToken: string
): Promise<void> {
  const existing = (await getDecryptedCredentials(brandId, PROVIDER).catch(() => null)) || {};
  const meta = await readGoogle(brandId);

  const accounts = meta.accounts.filter((a) => a.id !== account.id);
  accounts.push({
    id: account.id,
    email: account.email,
    connectedAt: new Date().toISOString(),
    // Re-consent can widen scopes; union so a narrower later grant doesn't
    // appear to remove access the customer already gave.
    scopes: Array.from(new Set([...(meta.accounts.find((a) => a.id === account.id)?.scopes || []), ...account.scopes])),
  });

  await upsertIntegrationCredentials(
    brandId,
    PROVIDER,
    { ...existing, [REFRESH_PREFIX + account.id]: refreshToken },
    { ...meta, accounts } satisfies GoogleMetadata
  );
}

/** Point a product at a resource (a GSC property, a GA4 property, a location). */
export async function selectResource(
  brandId: string,
  product: GoogleProductKey,
  selection: Omit<ProductSelection, "selectedAt">
): Promise<void> {
  const existing = (await getDecryptedCredentials(brandId, PROVIDER).catch(() => null)) || {};
  const meta = await readGoogle(brandId);
  await upsertIntegrationCredentials(brandId, PROVIDER, existing, {
    ...meta,
    selections: { ...meta.selections, [product]: { ...selection, selectedAt: new Date().toISOString() } },
  } satisfies GoogleMetadata);
}

/**
 * Disconnect one product. The Google account stays linked, because other
 * products may still be using it — disconnecting Analytics must not sign the
 * customer out of Search Console.
 */
export async function clearSelection(brandId: string, product: GoogleProductKey): Promise<void> {
  const existing = (await getDecryptedCredentials(brandId, PROVIDER).catch(() => null)) || {};
  const meta = await readGoogle(brandId);
  const selections = { ...meta.selections };
  delete selections[product];
  await upsertIntegrationCredentials(brandId, PROVIDER, existing, { ...meta, selections } satisfies GoogleMetadata);
}

/**
 * Unlink a Google account entirely, and every product pointed at it.
 * Leaving a selection behind would reference a token that no longer exists.
 */
export async function unlinkAccount(brandId: string, accountId: string): Promise<void> {
  const existing = (await getDecryptedCredentials(brandId, PROVIDER).catch(() => null)) || {};
  const meta = await readGoogle(brandId);

  delete existing[REFRESH_PREFIX + accountId];
  const accounts = meta.accounts.filter((a) => a.id !== accountId);
  const selections = Object.fromEntries(
    Object.entries(meta.selections).filter(([, s]) => s?.accountId !== accountId)
  ) as GoogleMetadata["selections"];

  if (!accounts.length) {
    // Nothing left to hold — mark the integration disconnected rather than
    // leaving an empty "connected" row behind.
    await disconnectIntegration(brandId, PROVIDER);
    return;
  }
  await upsertIntegrationCredentials(brandId, PROVIDER, existing, { accounts, selections } satisfies GoogleMetadata);
}
