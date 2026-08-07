// THE Google OAuth implementation. There is exactly one, and every Google
// product goes through it.
//
// Why it looks like this:
//
//   The platform previously reached Google with a SERVICE ACCOUNT, which
//   authenticates as itself. That works for Search Console properties an
//   administrator has manually shared, but it can never express "this customer
//   signed in and approved access", which is what Business Profile and GA4
//   require and what customers expect. Service accounts have no consent
//   screen. So a three-legged Web OAuth client was technically required — see
//   lib/google/registry.ts for how products declare themselves on top of it.
//
//   The service-account path is deliberately NOT removed. Search Console works
//   through it today for both live brands, and ripping it out to adopt OAuth
//   would trade working software for a migration. lib/gsc.ts prefers OAuth
//   when a customer has connected, and falls back otherwise.
//
// Nothing here is product-specific. Adding Google Ads or YouTube later touches
// registry.ts and a resource lister — never this file.

import { createHmac, timingSafeEqual } from "crypto";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_CLIENT_ID is not set.");
  return v;
}

function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not set.");
  return v;
}

/**
 * The redirect URI must match a value registered on the OAuth client EXACTLY,
 * including host and scheme, so it is derived from the request rather than
 * guessed. Registered values:
 *   https://junkfree-agent.vercel.app/api/portal/google/callback
 *   http://localhost:3001/api/portal/google/callback
 */
export function redirectUriFor(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/portal/google/callback`;
}

// ── CSRF state ──────────────────────────────────────────────────────────────
//
// The callback is a public GET. Without a signed state, anyone could hand a
// victim's browser a crafted callback URL and attach an attacker's Google
// account to that customer's brand. The state carries the brand and product
// and is HMAC-signed, so the callback trusts nothing the URL merely claims.

export type OAuthState = { brandId: string; product: string; origin: string; nonce: string };

export function signState(state: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const mac = createHmac("sha256", clientSecret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyState(raw: string): OAuthState | null {
  const [payload, mac] = (raw || "").split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", clientSecret()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return null;
  }
}

// ── The flow ────────────────────────────────────────────────────────────────

/**
 * Scopes the shared layer itself needs, on every request regardless of product.
 *
 * fetchIdentity() reads the OpenID userinfo endpoint to learn WHICH Google
 * account signed in, which is how accounts are keyed so a brand can link more
 * than one. That endpoint requires `openid`; a token carrying only a product
 * scope such as webmasters.readonly is rejected with 401 "Invalid Credentials"
 * — measured, and the cause of the first sign-in failing at
 * "Could not read Google account identity (401)".
 *
 * These belong here rather than in each product's scope list precisely because
 * they are the layer's requirement, not the product's: a future Ads or YouTube
 * entry gets them without having to know it needed them.
 */
export const IDENTITY_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

/**
 * Where to send the customer to sign in.
 *
 * `access_type=offline` + `prompt=consent` is what actually returns a refresh
 * token. Google only issues one on the FIRST authorisation unless consent is
 * forced, so omitting prompt=consent produces an integration that works once
 * and then silently cannot refresh — the classic failure here.
 */
export function authUrl(scopes: string[], redirectUri: string, state: string): string {
  // Deduplicated so a product that redundantly declares an identity scope
  // cannot produce a request asking for the same thing twice.
  const requested = Array.from(new Set([...IDENTITY_SCOPES, ...scopes]));
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: requested.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scopes: string[];
};

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string; refresh_token?: string; expires_in?: number;
    scope?: string; error?: string; error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    // Google's error text is developer-facing; callers translate it before it
    // reaches a customer (see lib/connections.ts).
    throw new Error(json.error_description || json.error || `Token request failed (${res.status})`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || null,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    scopes: (json.scope || "").split(" ").filter(Boolean),
  };
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
  return tokenRequest({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const set = await tokenRequest({
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: "refresh_token",
  });
  // A refresh response does not repeat the refresh token; keep the one we hold.
  return { ...set, refreshToken };
}

/** Best-effort revoke on disconnect, so access ends at Google too, not just here. */
export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  }).catch(() => {});
}

/**
 * Who signed in. Used to key accounts so a brand can link more than one Google
 * account, and to show the customer which address is connected.
 */
export async function fetchIdentity(accessToken: string): Promise<{ id: string; email: string }> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    // Include Google's own words. A bare status hid the first failure here:
    // 401 "Invalid Credentials" meant the token lacked `openid`, which is
    // indistinguishable from a genuinely bad token without the body.
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(
      `Could not read Google account identity (${res.status}). ` +
      `Check that IDENTITY_SCOPES are granted. Google said: ${detail}`
    );
  }
  const j = (await res.json()) as { sub?: string; email?: string };
  if (!j.sub) throw new Error("Google account identity was incomplete.");
  return { id: j.sub, email: j.email || "" };
}

/**
 * Whether a failure means the customer must sign in again, as opposed to a
 * transient fault. `invalid_grant` is what Google returns when a refresh token
 * has been revoked, has expired (7 days while the app is unpublished), or the
 * password changed — all of which need a human, not a retry.
 */
export function isGrantExpired(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /invalid_grant|token has been expired or revoked|invalid_rapt/i.test(m);
}
