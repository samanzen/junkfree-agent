// The shared Google OAuth layer.
//
// These tests concentrate on the properties that are expensive to get wrong
// and invisible when they are: the callback is a public endpoint, refresh
// tokens are the only durable secret, and "one OAuth implementation" is a
// claim that decays the moment a second product adds its own.

import fs from "fs";
import { test, expect } from "vitest";
import { signState, verifyState, authUrl, IDENTITY_SCOPES } from "../google/oauth";
import { GOOGLE_PRODUCTS, GOOGLE_PRODUCT_KEYS, isGoogleProduct } from "../google/registry";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

// signState/verifyState HMAC with GOOGLE_CLIENT_SECRET.
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "test-secret-for-hmac";

// ── the callback is public, so state is the only thing standing guard ───────
test("a valid state round-trips", () => {
  const state = { brandId: "brand-1", product: "search_console", origin: "https://x.test", nonce: "n1" };
  expect(verifyState(signState(state))).toEqual(state);
});

test("a tampered state is rejected", () => {
  // The attack this prevents: swapping brandId to attach an attacker's Google
  // account to somebody else's brand.
  const signed = signState({ brandId: "victim", product: "search_console", origin: "https://x.test", nonce: "n" });
  const [payload, mac] = signed.split(".");
  const forged = Buffer.from(
    JSON.stringify({ brandId: "attacker", product: "search_console", origin: "https://x.test", nonce: "n" })
  ).toString("base64url");
  expect(verifyState(`${forged}.${mac}`)).toBeNull();
  expect(verifyState(`${payload}.deadbeef`)).toBeNull();
  expect(verifyState("garbage")).toBeNull();
  expect(verifyState("")).toBeNull();
});

test("the callback refuses to act on an unverified state", () => {
  const src = read("app/api/portal/google/callback/route.ts");
  expect(src).toMatch(/const state = verifyState\(rawState\)/);
  // Every use of the brand comes from the verified state, never the raw query.
  expect(src).not.toMatch(/searchParams\.get\("brand"\)/);
});

// ── refresh tokens ──────────────────────────────────────────────────────────
test("consent is forced so a refresh token is actually returned", () => {
  // Google issues a refresh token only on first authorisation unless consent
  // is forced. Without this the connection works for an hour and then dies.
  const src = read("lib/google/oauth.ts");
  expect(src).toMatch(/access_type: "offline"/);
  expect(src).toMatch(/prompt: "consent"/);
});

test("a missing refresh token is treated as a failure, not a success", () => {
  const src = read("app/api/portal/google/callback/route.ts");
  expect(src).toMatch(/if \(!tokens\.refreshToken\)/);
});

test("refreshing keeps the refresh token we already hold", () => {
  // Google does not repeat the refresh token on a refresh response; returning
  // the response verbatim would blank it and break the next refresh.
  expect(read("lib/google/oauth.ts")).toMatch(/return \{ \.\.\.set, refreshToken \}/);
});

test("linking a second account preserves the first", () => {
  // upsertIntegrationCredentials replaces the whole bag, so existing tokens
  // must be merged in or every other Google account is silently unlinked.
  const src = read("lib/google/store.ts");
  expect(src).toMatch(/const existing = \(await getDecryptedCredentials/);
  expect(src).toMatch(/\{ \.\.\.existing, \[REFRESH_PREFIX \+ account\.id\]: refreshToken \}/);
});

test("an expired grant is distinguished from a transient failure", () => {
  // invalid_grant needs a human to sign in again; retrying cannot fix it.
  const src = read("lib/google/oauth.ts");
  expect(src).toMatch(/invalid_grant/);
  expect(read("lib/google/tokens.ts")).toMatch(/isGrantExpired\(err\)/);
});

// ── one implementation, not three ───────────────────────────────────────────
test("only the shared layer talks to Google's token endpoint", () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(`${ROOT}/${dir}`, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p) && p !== "lib/google/oauth.ts" && /oauth2\.googleapis\.com\/token/.test(read(p))) {
        offenders.push(p);
      }
    }
  };
  walk("lib");
  walk("app");
  expect(offenders).toEqual([]);
});

test("products declare themselves rather than implementing auth", () => {
  const src = read("lib/google/registry.ts");
  // A product lists resources with a token handed to it; it never mints one.
  expect(src).not.toMatch(/client_secret|refresh_token|grant_type/);
  for (const key of GOOGLE_PRODUCT_KEYS) {
    expect(GOOGLE_PRODUCTS[key].scopes.length).toBeGreaterThan(0);
    expect(typeof GOOGLE_PRODUCTS[key].listResources).toBe("function");
  }
});

test("all three products are registered and recognised", () => {
  expect(GOOGLE_PRODUCT_KEYS.sort()).toEqual(
    ["google_analytics", "google_business_profile", "search_console"]
  );
  expect(isGoogleProduct("search_console")).toBe(true);
  expect(isGoogleProduct("dropbox")).toBe(false);
});

test("every authorisation request carries the identity scopes", () => {
  // The layer reads the OpenID userinfo endpoint to key accounts by Google
  // user id. A token holding only a product scope is rejected there with 401
  // "Invalid Credentials" — which is exactly how the first sign-in failed.
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test-client-id";
  const url = new URL(
    authUrl(["https://www.googleapis.com/auth/webmasters.readonly"], "https://x.test/cb", "state")
  );
  const scope = (url.searchParams.get("scope") || "").split(" ");
  for (const s of IDENTITY_SCOPES) expect(scope).toContain(s);
  // ...without losing the product scope.
  expect(scope).toContain("https://www.googleapis.com/auth/webmasters.readonly");
});

test("identity scopes live in the shared layer, not in each product", () => {
  // A future Ads or YouTube entry must inherit them rather than remember to
  // declare them.
  for (const key of GOOGLE_PRODUCT_KEYS) {
    for (const s of IDENTITY_SCOPES) {
      expect(GOOGLE_PRODUCTS[key].scopes).not.toContain(s);
    }
  }
  expect(IDENTITY_SCOPES).toEqual([
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ]);
});

test("a scope is never requested twice", () => {
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test-client-id";
  const url = new URL(authUrl(["openid", "https://www.googleapis.com/auth/analytics.readonly"], "https://x.test/cb", "s"));
  const scope = (url.searchParams.get("scope") || "").split(" ");
  expect(new Set(scope).size).toBe(scope.length);
});

test("each product asks only for the scopes it needs", () => {
  expect(GOOGLE_PRODUCTS.search_console.scopes).toEqual([
    "https://www.googleapis.com/auth/webmasters.readonly",
  ]);
  expect(GOOGLE_PRODUCTS.google_analytics.scopes).toEqual([
    "https://www.googleapis.com/auth/analytics.readonly",
  ]);
  expect(GOOGLE_PRODUCTS.google_business_profile.scopes).toEqual([
    "https://www.googleapis.com/auth/business.manage",
  ]);
});

// ── authorisation ───────────────────────────────────────────────────────────
test("starting a connection requires access to the brand", () => {
  const src = read("app/api/portal/google/start/route.ts");
  expect(src).toMatch(/requireAuth\(req\)/);
  expect(src).toMatch(/requireBrandAccess\(auth, brandId\)/);
});

test("the start route returns a URL rather than redirecting", () => {
  // A top-level navigation would not carry the portal's bearer token.
  const src = read("app/api/portal/google/start/route.ts");
  expect(src).toMatch(/NextResponse\.json\(\{ url: target \}\)/);
  expect(src).not.toMatch(/NextResponse\.redirect/);
});

test("a chosen resource is verified against Google before being stored", () => {
  // Otherwise a crafted request could point a brand at a property the
  // customer has no access to.
  const src = read("app/api/portal/google/select/route.ts");
  expect(src).toMatch(/const resources = await listResourcesFor\(brandId, key, accountId\)/);
  expect(src).toMatch(/if \(!match\)/);
  expect(src).toMatch(/status: 403/);
});

test("disconnecting clears the Search Console property the rest of the app reads", () => {
  // brands.gsc_property drives every existing query; leaving it set would keep
  // pulling data the customer just disconnected.
  const src = read("app/api/portal/google/select/route.ts");
  expect(src).toMatch(/gsc_property: null/);
  expect(src).toMatch(/gsc_property: resourceId/);
});

test("unlinking an account revokes it at Google, not just locally", () => {
  expect(read("app/api/portal/google/select/route.ts")).toMatch(/await revokeToken\(token\)/);
});

// ── no secrets or provider errors reach the customer ────────────────────────
test("tokens and secrets are never returned to the browser", () => {
  for (const f of [
    "app/api/portal/google/start/route.ts",
    "app/api/portal/google/callback/route.ts",
    "app/api/portal/google/select/route.ts",
  ]) {
    const src = read(f);
    expect(src).not.toMatch(/json\(\{[^}]*refreshToken/);
    expect(src).not.toMatch(/json\(\{[^}]*accessToken/);
    // Routes must never READ the secret — only lib/google/oauth.ts does.
    // (Naming it in a server-side console.error is fine and is not a leak.)
    expect(src).not.toMatch(/process\.env\.GOOGLE_CLIENT_SECRET/);
  }
});

test("the callback always returns the customer to the portal", () => {
  // They are in a browser tab; a JSON body would be the worst possible ending
  // to a sign-in.
  const src = read("app/api/portal/google/callback/route.ts");
  expect(src).toMatch(/NextResponse\.redirect\(url\.toString\(\)\)/);
  expect(src).not.toMatch(/NextResponse\.json/);
});
