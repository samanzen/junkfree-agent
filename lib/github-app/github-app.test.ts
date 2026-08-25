import { expect, test, vi } from "vitest";
import fs from "fs";
import { createHmac } from "crypto";
import { rankReposForSite, type RepoAnalysis } from "./analyze";
import { GITHUB_APP_PERMISSIONS } from "./plan";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

function baseAnalysis(over: Partial<RepoAnalysis> = {}): RepoAnalysis {
  return {
    repoId: 1,
    fullName: "acme/site",
    owner: "acme",
    name: "site",
    private: true,
    defaultBranch: "main",
    framework: "Next.js",
    packageManager: "pnpm",
    contentPath: "content",
    hasBlogHints: true,
    hasSitemapHints: false,
    deploymentProvider: "Vercel",
    likelyDomain: "https://acme.com",
    confidence: "high",
    confidenceScore: 70,
    evidence: ["Homepage set"],
    canCreateBranch: true,
    canOpenPullRequest: true,
    canUpdateContent: true,
    ...over,
  };
}

test("documented GitHub App permissions stay minimal", () => {
  expect(GITHUB_APP_PERMISSIONS).toEqual({
    metadata: "read",
    contents: "read_write",
    pull_requests: "read_write",
  });
});

test("rankReposForSite auto-picks a clear high-confidence winner", () => {
  const best = baseAnalysis({ repoId: 10, confidenceScore: 80, confidence: "high" });
  const other = baseAnalysis({
    repoId: 11,
    name: "other",
    fullName: "acme/other",
    confidenceScore: 40,
    confidence: "medium",
  });
  const ranked = rankReposForSite([other, best]);
  expect(ranked.best?.repoId).toBe(10);
  expect(ranked.ambiguous).toBe(false);
});

test("rankReposForSite marks close scores as ambiguous", () => {
  const a = baseAnalysis({ repoId: 1, confidenceScore: 50, confidence: "medium" });
  const b = baseAnalysis({ repoId: 2, confidenceScore: 48, confidence: "medium", name: "b" });
  const ranked = rankReposForSite([a, b]);
  expect(ranked.ambiguous).toBe(true);
});

test("state HMAC verify rejects tampering", async () => {
  process.env.GITHUB_APP_STATE_SECRET = "test-state-secret-for-unit";
  process.env.GITHUB_APP_ID = "1";
  process.env.GITHUB_APP_PRIVATE_KEY = "x";
  process.env.GITHUB_APP_SLUG = "volo-test";
  const { signGitHubAppState, verifyGitHubAppState } = await import("./auth");
  const raw = signGitHubAppState({
    brandId: "brand-a",
    userId: "user-a",
    origin: "https://example.com",
    siteUrl: "https://site.example",
    nonce: "nonce1",
  });
  expect(verifyGitHubAppState(raw)?.brandId).toBe("brand-a");
  const [payload] = raw.split(".");
  const badMac = createHmac("sha256", "wrong").update(payload).digest("base64url");
  expect(verifyGitHubAppState(`${payload}.${badMac}`)).toBeNull();
  expect(verifyGitHubAppState(raw.slice(0, -2) + "aa")).toBeNull();
});

test("customer UI has Connect GitHub and no PAT form fields", () => {
  const wizard = read("app/portal/settings/_ConnectWebsite.tsx");
  const ghUi = read("app/portal/settings/_GitHubAppConnect.tsx");
  const panel = read("app/portal/settings/_ConnectionsPanel.tsx");
  expect(wizard).toMatch(/\/api\/portal\/github\/start/);
  expect(wizard).toMatch(/Redirecting to GitHub/);
  expect(wizard).not.toMatch(/Personal access token/);
  expect(wizard).not.toMatch(/ghOwner|ghToken|ghPath/);
  expect(panel).toMatch(/GitHubAppConnect/);
  expect(ghUi).toMatch(/Which repository contains this website/);
  expect(ghUi).toMatch(/Confirm connection/);
  expect(ghUi).toMatch(/progressbar/);
  expect(ghUi).toMatch(/% complete/);
  expect(ghUi).toMatch(/startedRef/);
  expect(ghUi).not.toMatch(/Personal access token/);
});

test("repo discovery is metadata-only to avoid rate limits", () => {
  const repos = read("app/api/portal/github/repos/route.ts");
  const analyze = read("lib/github-app/analyze.ts");
  const api = read("lib/github-app/api.ts");
  expect(repos).toMatch(/analysisFromMetadata/);
  expect(repos).toMatch(/Metadata-only/);
  expect(repos).not.toMatch(/analyzeRepository\(/);
  expect(analyze).toMatch(/analysisFromMetadata/);
  expect(api).toMatch(/installTokenCache/);
  expect(api).toMatch(/getInstallationRepo/);
});

test("GitHub App API routes and webhook exist", () => {
  for (const p of [
    "app/api/portal/github/start/route.ts",
    "app/api/portal/github/callback/route.ts",
    "app/api/portal/github/repos/route.ts",
    "app/api/portal/github/select/route.ts",
    "app/api/portal/github/status/route.ts",
    "app/api/portal/github/disconnect/route.ts",
    "app/api/webhooks/github/route.ts",
    "supabase/025_github_app_connection.sql",
    "docs/github-app-setup.md",
  ]) {
    expect(fs.existsSync(p), p).toBe(true);
  }
  const start = read("app/api/portal/github/start/route.ts");
  expect(start).toMatch(/requireAuth/);
  expect(start).toMatch(/requireBrandAccess/);
  expect(start).toMatch(/signGitHubAppState/);
  expect(start).toMatch(/createAuthAttempt/);

  const cb = read("app/api/portal/github/callback/route.ts");
  expect(cb).toMatch(/verifyGitHubAppState/);
  expect(cb).toMatch(/consumeAuthAttempt/);
  expect(cb).toMatch(/getInstallation/);
  expect(cb).toMatch(/replay/);

  const wh = read("app/api/webhooks/github/route.ts");
  expect(wh).toMatch(/x-hub-signature-256/);
  expect(wh).toMatch(/installation/);
});

test("callback never throws bare 500 — redirects with reason", () => {
  const src = read("app/api/portal/github/callback/route.ts");
  expect(src).toMatch(/Must never throw a bare 500/);
  expect(src).toMatch(/catch \(e\)/);
  expect(src).toMatch(/reason: "error"/);
  expect(src).toMatch(/pendingErr/);
});

test("App JWT creation is fail-closed without throwing in API requests", () => {
  const api = read("lib/github-app/api.ts");
  const auth = read("lib/github-app/auth.ts");
  expect(api).toMatch(/tryCreateAppJwt/);
  expect(auth).toMatch(/tryCreateAppJwt/);
  expect(auth).toMatch(/does not look like a PEM private key/);
});

test("github adapter mints installation tokens for App connections", () => {
  const src = read("lib/execution/adapters/github.ts");
  expect(src).toMatch(/createInstallationToken/);
  expect(src).toMatch(/github_app/);
  expect(src).toMatch(/Never writes directly to the default branch/);
  expect(src).not.toMatch(/getInstallationAccessToken/);
});

test("adapter check fails closed without credentials", async () => {
  vi.resetModules();
  const { githubAdapter } = await import("../execution/adapters/github");
  const r = await githubAdapter.check({
    brand: { id: "b", site_url: "https://example.com" } as never,
    credentials: {},
    config: {},
  });
  expect(r.ok).toBe(false);
  expect(r.detail).toMatch(/Connect GitHub|not selected|not connected/i);
});
