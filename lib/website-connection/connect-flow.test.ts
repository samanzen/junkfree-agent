import { expect, test } from "vitest";
import fs from "fs";
import { detectWebsite, FUNCTIONAL_CONNECTORS, UNSUPPORTED_CONNECTORS } from "../website-connection/detect";
import { githubAdapter } from "../execution/adapters/github";
import { sanityAdapter } from "../execution/adapters/sanity";
import { wordpressAdapter } from "../execution/adapters/wordpress";
import { capabilityMapFor } from "../execution/site-capabilities";
import { SITE_PLATFORMS, isSitePlatform } from "../execution/registry";
import { describeWebsiteConnection } from "../website-connection/resolve";
import type { Brand } from "../brands";

test("functional connectors never include unsupported platforms", () => {
  expect(FUNCTIONAL_CONNECTORS.every((c) => c.connectable)).toBe(true);
  expect(UNSUPPORTED_CONNECTORS.every((c) => !c.connectable)).toBe(true);
  expect(UNSUPPORTED_CONNECTORS.map((c) => c.id)).toEqual(
    expect.arrayContaining(["wix", "webflow", "ftp", "gitlab", "contentful", "strapi"])
  );
});

test("SITE_PLATFORMS includes github and sanity", () => {
  expect(isSitePlatform("github")).toBe(true);
  expect(isSitePlatform("sanity")).toBe(true);
  expect(SITE_PLATFORMS).toEqual(
    expect.arrayContaining(["wordpress", "shopify", "webhook", "proxy", "github", "sanity"])
  );
});

test("GitHub and Sanity claim page + meta operations", () => {
  expect(githubAdapter.capabilities).toEqual(expect.arrayContaining(["upsert_page", "update_meta"]));
  expect(sanityAdapter.capabilities).toEqual(expect.arrayContaining(["upsert_page", "update_meta"]));
  expect(capabilityMapFor(githubAdapter).update_meta?.state).toBe("supported_unverified");
  expect(capabilityMapFor(wordpressAdapter).update_meta?.state).toBe("supported_unverified");
});

test("GitHub check fails closed without token/repo", async () => {
  const r = await githubAdapter.check({
    brand: { id: "b", site_url: "https://example.com" } as Brand,
    credentials: {},
    config: {},
  });
  expect(r.ok).toBe(false);
});

test("Sanity check fails closed without project/token", async () => {
  const r = await sanityAdapter.check({
    brand: { id: "b", site_url: "https://example.com" } as Brand,
    credentials: {},
    config: {},
  });
  expect(r.ok).toBe(false);
});

test("detectWebsite rejects non-https", async () => {
  const r = await detectWebsite("ftp://example.com");
  expect(r).toEqual(expect.objectContaining({ error: expect.stringMatching(/https/i) }));
});

test("detectWebsite recommends a connectable connector for a live site", async () => {
  const r = await detectWebsite("https://www.wordpress.org");
  if ("error" in r) {
    // Network may be blocked in some environments — skip soft.
    expect(r.error).toBeTruthy();
    return;
  }
  expect(r.recommended.connectable).toBe(true);
  expect(FUNCTIONAL_CONNECTORS.map((c) => c.id)).toContain(r.recommended.id);
}, 20_000);

test("Connect Website wizard and detect API exist", () => {
  expect(fs.existsSync("app/portal/settings/_ConnectWebsite.tsx")).toBe(true);
  expect(fs.existsSync("app/api/portal/website-detect/route.ts")).toBe(true);
  const panel = fs.readFileSync("app/portal/settings/_ConnectionsPanel.tsx", "utf8");
  expect(panel).toMatch(/ConnectWebsite/);
  const wizard = fs.readFileSync("app/portal/settings/_ConnectWebsite.tsx", "utf8");
  expect(wizard).toMatch(/Use a different connection method/);
  expect(wizard).toMatch(/execution_mode/);
  expect(wizard).toMatch(/Approval|Hybrid|Autopilot/);
});

test("POMO managed pages still describe as connected + managed_pages available", () => {
  const brand = {
    id: "9bb33e02-2357-420c-b082-1335588fd19c",
    name: "POMO BUILD",
    slug: "pomobuild",
    site_url: "https://www.pomobuild.ca",
    primary_writer: "proxy",
    proxy_site_token: "site_" + "a".repeat(32),
    proxy_namespace: "guides",
    source_of_truth: { confirmed: "platform_proxy", confirmed_at: "2026-08-21T00:00:00Z" },
    site_capabilities: {
      upsert_page: {
        state: "certified",
        writer: "proxy",
        reason: "Working",
        certified_at: "2026-08-21T00:00:00Z",
        last_execution_id: null,
        fail_count: 0,
      },
      update_meta: {
        state: "unsupported",
        writer: "proxy",
        reason: "n/a",
        certified_at: null,
        last_execution_id: null,
        fail_count: 0,
      },
    },
  } as unknown as Brand;
  const view = describeWebsiteConnection(brand);
  expect(view.connected).toBe(true);
  expect(view.adapterId).toBe("managed_pages");
  expect(view.capabilities.find((c) => c.key === "managed_pages")?.status).toBe("available");
});
