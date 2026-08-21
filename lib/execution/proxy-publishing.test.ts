import { expect, test } from "vitest";
import fs from "fs";
import {
  newProxySiteToken,
  isProxySiteToken,
  isProxyNamespace,
  normalizeProxyNamespace,
  parseProxyClaimCheck,
} from "./proxy-token";
import { proxyAdapter } from "./adapters/proxy";
import { capabilityMapFor, isOperationCertified } from "./site-capabilities";
import { SITE_PLATFORMS, isSitePlatform } from "./registry";
import { writerForConfirmed } from "./source-of-truth";

const read = (p: string) => fs.readFileSync(p, "utf8");

test("migration 022 pins token on brands with uniqueness and format checks", () => {
  const sql = read("supabase/022_proxy_publishing.sql");
  expect(sql).toMatch(/proxy_site_token/);
  expect(sql).toMatch(/proxy_namespace/);
  expect(sql).toMatch(/proxy_claim_check jsonb/);
  expect(sql).toMatch(/brands_proxy_site_token_key/);
  expect(sql).toMatch(/primary_writer is distinct from 'proxy'/);
  expect(sql).not.toMatch(/create table/i);
  expect(sql).toMatch(/No brand_integrations row/);
});

test("proxy is a registered SitePlatform without a brand_integrations provider", () => {
  expect(isSitePlatform("proxy")).toBe(true);
  expect(SITE_PLATFORMS).toEqual(
    expect.arrayContaining(["wordpress", "shopify", "webhook", "proxy"])
  );
});

test("token generation matches the SQL format check", () => {
  const token = newProxySiteToken();
  expect(isProxySiteToken(token)).toBe(true);
  expect(isProxySiteToken("site_not-hex")).toBe(false);
  expect(isProxySiteToken("tok_abcdef0123456789abcdef0123456789")).toBe(false);
});

test("namespace rejects reserved paths and uppercase", () => {
  expect(isProxyNamespace("guides")).toBe(true);
  expect(isProxyNamespace("resources")).toBe(true);
  expect(isProxyNamespace("api")).toBe(false);
  expect(isProxyNamespace("wp-admin")).toBe(false);
  expect(isProxyNamespace("Guides")).toBe(false);
  expect(normalizeProxyNamespace("/Guides/")).toBe("guides");
});

test("proxy claims pages unverified and titles unsupported (CMS upsell)", () => {
  const map = capabilityMapFor(proxyAdapter);
  expect(map.upsert_page?.state).toBe("supported_unverified");
  expect(map.upsert_page?.writer).toBe("proxy");
  expect(map.update_meta?.state).toBe("unsupported");
  expect(map.update_meta?.reason).toMatch(/WordPress or Shopify/i);
  expect(isOperationCertified(map, "upsert_page")).toBe(false);
});

test("platform_proxy SoT maps to the proxy writer", () => {
  expect(writerForConfirmed("platform_proxy")).toBe("proxy");
});

test("claim-check shape parses", () => {
  const parsed = parseProxyClaimCheck({
    namespace: "guides",
    result: "clear",
    probes: [{ path: "/guides/x", status: 404 }],
    checked_at: "2026-08-21T00:00:00Z",
    detail: "Path is free.",
  });
  expect(parsed?.result).toBe("clear");
  expect(parseProxyClaimCheck({})).toBeNull();
});

test("proxy adapter check requires token + namespace; apply is not live yet", async () => {
  const brand = {
    id: "b1",
    slug: "acme",
    name: "Acme",
    site_url: "https://acme.example",
  } as never;
  const bad = await proxyAdapter.check({
    brand,
    credentials: {},
    config: {},
  });
  expect(bad.ok).toBe(false);

  const token = newProxySiteToken();
  const ok = await proxyAdapter.check({
    brand,
    credentials: { siteToken: token },
    config: { namespace: "guides" },
  });
  expect(ok.ok).toBe(true);

  const applied = await proxyAdapter.apply(
    { brand, credentials: { siteToken: token }, config: { namespace: "guides" } },
    {
      type: "upsert_page",
      slug: "hello",
      title: "Hello",
      metaDescription: null,
      bodyMarkdown: "Hi",
    }
  );
  expect(applied.ok).toBe(false);
  if (!applied.ok) expect(applied.error).toMatch(/not live yet/i);
});

test("disconnect loops skip proxy provider (no brand_integrations row)", () => {
  const publish = read("app/api/portal/publishing/route.ts");
  const connections = read("app/api/portal/connections/route.ts");
  expect(publish).toMatch(/INTEGRATION_SITE_PLATFORMS/);
  expect(connections).toMatch(/INTEGRATION_SITE_PLATFORMS/);
  expect(read("lib/execution/engine.ts")).toMatch(/pinned === "proxy"/);
  expect(read("lib/execution/engine.ts")).toMatch(/targetFromProxyBrand/);
});
