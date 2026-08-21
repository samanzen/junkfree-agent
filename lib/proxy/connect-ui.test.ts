import { test, expect } from "vitest";
import { evaluateClaimProbes, claimAllowsSetup } from "./claim-check";
import { rewriteSnippets, SNIPPET_HOSTS } from "./snippets";
import { diagnoseProxyCertFailure } from "../publish-check";
import fs from "fs";
import path from "path";

const probe = (pathName: string, status: number | null, extra?: { note?: string; headers?: Record<string, string> }) => ({
  path: pathName,
  status,
  ...extra,
});

test("clear when hub and leaf are not 200 and root is reachable", () => {
  const result = evaluateClaimProbes({
    namespace: "guides",
    root: probe("/", 200),
    hub: probe("/guides/", 404),
    leaf: probe("/guides/__probe-abcd1234", 404),
  });
  expect(result.result).toBe("clear");
  expect(claimAllowsSetup(result.result)).toBe(true);
});

test("collision when hub already returns 200", () => {
  const result = evaluateClaimProbes({
    namespace: "guides",
    root: probe("/", 200),
    hub: probe("/guides/", 200),
    leaf: probe("/guides/__probe-abcd1234", 404),
  });
  expect(result.result).toBe("collision");
  expect(claimAllowsSetup(result.result)).toBe(false);
  expect(result.detail).toMatch(/already serves/i);
});

test("loop when any probe carries X-Proxy-Origin", () => {
  const result = evaluateClaimProbes({
    namespace: "guides",
    root: probe("/", 200),
    hub: probe("/guides/", 404, { headers: { "x-proxy-origin": "1" } }),
    leaf: probe("/guides/__probe-abcd1234", 404),
  });
  expect(result.result).toBe("loop");
  expect(claimAllowsSetup(result.result)).toBe(false);
});

test("unreachable when root cannot be fetched", () => {
  const result = evaluateClaimProbes({
    namespace: "guides",
    root: probe("/", null, { note: "timeout" }),
    hub: probe("/guides/", null),
    leaf: probe("/guides/__probe-abcd1234", null),
  });
  expect(result.result).toBe("unreachable");
  expect(claimAllowsSetup(result.result)).toBe(false);
});

test("catch-all leaf 200 still clears with a note", () => {
  const result = evaluateClaimProbes({
    namespace: "guides",
    root: probe("/", 200),
    hub: probe("/guides/", 404),
    leaf: probe("/guides/__probe-abcd1234", 200),
  });
  expect(result.result).toBe("clear");
  expect(result.detail).toMatch(/catch-all/i);
});

test("snippets keep namespace in source and destination for every host", () => {
  const snippets = rewriteSnippets({
    namespace: "resources",
    token: "site_" + "a".repeat(32),
    appOrigin: "https://app.example",
    siteHost: "www.acme.com",
  });
  expect(SNIPPET_HOSTS.map((h) => h.id)).toEqual([
    "netlify",
    "vercel",
    "cloudflare",
    "nginx",
    "apache",
    "unknown",
  ]);
  for (const host of SNIPPET_HOSTS) {
    const body = snippets[host.id].body;
    expect(body).toMatch(/resources/);
    if (host.id !== "unknown") {
      expect(body).toMatch(/\/s\/site_/);
    }
  }
  expect(snippets.unknown.body).toMatch(/CNAME/i);
  expect(snippets.unknown.hint).toMatch(/email/i);
});

test("proxy prove diagnostics distinguish 404, redirect, wrong content, timeout", () => {
  const expected = {
    url: "https://acme.com/guides/seo-cert-abcd1234",
    siteUrl: "https://acme.com",
    titleToken: "t1",
    bodyToken: "b1",
    mode: "present" as const,
  };
  expect(
    diagnoseProxyCertFailure({ ok: false, error: "The operation was aborted due to timeout" }, expected)
  ).toMatch(/Timed out/i);
  expect(
    diagnoseProxyCertFailure(
      { ok: true, status: 404, url: expected.url, title: "Not Found", text: "404", canonical: "" },
      expected
    )
  ).toMatch(/404/);
  expect(
    diagnoseProxyCertFailure(
      { ok: true, status: 301, url: "https://elsewhere/x", title: "", text: "", canonical: "" },
      expected
    )
  ).toMatch(/redirect/i);
  expect(
    diagnoseProxyCertFailure(
      {
        ok: true,
        status: 200,
        url: expected.url,
        title: "Home",
        text: "Welcome",
        canonical: "https://acme.com/",
      },
      expected
    )
  ).toMatch(/wrong content|path name/i);
});

test("Connect UI ships four-step ProxySetup and claim-check API", () => {
  const root = process.cwd();
  const setup = fs.readFileSync(path.join(root, "app/portal/settings/_ProxySetup.tsx"), "utf8");
  expect(setup).toMatch(/Step \{step\} of 4/);
  expect(setup).toMatch(/\/api\/proxy\/claim-check/);
  expect(setup).toMatch(/\/api\/proxy\/setup/);
  expect(setup).toMatch(/Email these instructions/);
  expect(setup).toMatch(/I&apos;ve added the rewrite/);
  const panel = fs.readFileSync(path.join(root, "app/portal/settings/_ConnectionsPanel.tsx"), "utf8");
  expect(panel).toMatch(/ProxySetup/);
  expect(panel).toMatch(/proxyNavNudge/);
  expect(panel).toMatch(/Path on your site/);
  const nudge = fs.readFileSync(path.join(root, "app/portal/_components/ProxyNavNudgeCard.tsx"), "utf8");
  expect(nudge).toMatch(/Add one link/);
  expect(fs.existsSync(path.join(root, "app/api/proxy/claim-check/route.ts"))).toBe(true);
  expect(fs.existsSync(path.join(root, "app/api/proxy/setup/route.ts"))).toBe(true);
  expect(fs.existsSync(path.join(root, "app/api/cron/proxy-claim-health/route.ts"))).toBe(true);
});
