import { createHmac, createSign, randomBytes, timingSafeEqual } from "crypto";

/** GitHub App env + JWT + CSRF state. Secrets never reach the browser. */

export function githubAppConfigured(): boolean {
  return !!(
    process.env.GITHUB_APP_ID &&
    process.env.GITHUB_APP_PRIVATE_KEY &&
    process.env.GITHUB_APP_SLUG
  );
}

export function githubAppSlug(): string {
  const s = process.env.GITHUB_APP_SLUG;
  if (!s) throw new Error("GITHUB_APP_SLUG is not set.");
  return s.replace(/^\/+|\/+$/g, "");
}

export function githubAppId(): string {
  const id = process.env.GITHUB_APP_ID;
  if (!id) throw new Error("GITHUB_APP_ID is not set.");
  return id;
}

function privateKeyPem(): string {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!raw) throw new Error("GITHUB_APP_PRIVATE_KEY is not set.");
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

function stateSecret(): string {
  const s = process.env.GITHUB_APP_STATE_SECRET || process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!s) throw new Error("GITHUB_APP_STATE_SECRET or INTEGRATION_ENCRYPTION_KEY is required.");
  return s;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

/** Short-lived App JWT for GitHub App API (max 10 minutes). */
export function createAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: githubAppId(),
    })
  );
  const data = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const sig = signer.sign(privateKeyPem()).toString("base64url");
  return `${data}.${sig}`;
}

export type GitHubAppState = {
  brandId: string;
  userId: string;
  origin: string;
  nonce: string;
  siteUrl: string | null;
  exp: number;
};

export function signGitHubAppState(state: Omit<GitHubAppState, "nonce" | "exp"> & { nonce?: string }): string {
  const full: GitHubAppState = {
    ...state,
    nonce: state.nonce || randomBytes(16).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  };
  const payload = b64url(JSON.stringify(full));
  const mac = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyGitHubAppState(raw: string): GitHubAppState | null {
  const [payload, mac] = (raw || "").split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GitHubAppState;
    if (!state.brandId || !state.userId || !state.nonce || !state.exp) return null;
    if (state.exp < Math.floor(Date.now() / 1000)) return null;
    return state;
  } catch {
    return null;
  }
}

/** Official install URL — customer authorizes on github.com then returns to Setup URL. */
export function githubAppInstallUrl(state: string): string {
  const slug = githubAppSlug();
  const params = new URLSearchParams({ state });
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?${params}`;
}

/** Deep link to add repos to an existing installation. */
export function githubAppConfigureUrl(installationId: number | string): string {
  const slug = githubAppSlug();
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/${installationId}`;
}

export function callbackPath(): string {
  return "/api/portal/github/callback";
}
