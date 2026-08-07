// Access tokens, refreshed automatically.
//
// Callers ask for `accessTokenFor(brandId, accountId)` and never think about
// expiry. Google access tokens last about an hour; refresh tokens are what we
// store, and they are exchanged for a fresh access token on demand.
//
// Separate from oauth.ts on purpose: oauth.ts talks to Google and knows nothing
// about brands, while this knows how the platform stores things. Keeping the
// protocol free of storage is what lets a future product reuse it untouched.

import { refreshAccessToken, isGrantExpired } from "./oauth";
import { refreshTokenFor } from "./store";
import { markIntegrationError } from "../integrations";

/**
 * Access tokens are cached in memory for the life of the server process.
 *
 * Without this, every resource listing would spend a network round trip
 * re-minting a token that is valid for an hour. Cached per (brand, account)
 * and expired a minute early so a token cannot lapse mid-request.
 *
 * In-memory is the right scope: serverless instances are short-lived, and
 * persisting access tokens would mean storing a second secret for no gain when
 * the refresh token can always mint another.
 */
const cache = new Map<string, { token: string; expiresAt: number }>();
const SKEW_MS = 60_000;

export class GoogleReauthRequired extends Error {
  constructor(public readonly accountId: string) {
    super("This Google account needs to be reconnected.");
    this.name = "GoogleReauthRequired";
  }
}

export async function accessTokenFor(brandId: string, accountId: string): Promise<string> {
  const key = `${brandId}:${accountId}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now() + SKEW_MS) return hit.token;

  const refreshToken = await refreshTokenFor(brandId, accountId);
  if (!refreshToken) throw new GoogleReauthRequired(accountId);

  try {
    const set = await refreshAccessToken(refreshToken);
    cache.set(key, { token: set.accessToken, expiresAt: set.expiresAt });
    return set.accessToken;
  } catch (err) {
    cache.delete(key);
    if (isGrantExpired(err)) {
      // The customer must sign in again — a retry cannot fix this. Recorded so
      // the Connections page can say "Reconnect needed" instead of failing
      // silently on the next sync.
      await markIntegrationError(
        brandId,
        "google",
        `Google access needs re-authorising for account ${accountId}.`
      ).catch(() => {});
      throw new GoogleReauthRequired(accountId);
    }
    throw err;
  }
}

/** Drop cached tokens for a brand, e.g. after disconnecting. */
export function forgetTokens(brandId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${brandId}:`)) cache.delete(key);
  }
}
