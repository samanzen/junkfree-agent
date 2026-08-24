import { expect, test } from "vitest";
import fs from "fs";
import {
  DEFAULT_MANAGED_NAMESPACE,
  describeWebsiteConnection,
  resolvePublishMethod,
  websiteAdapterMeta,
} from "../website-connection";
import type { Brand } from "../brands";

const POMO_ID = "9bb33e02-2357-420c-b082-1335588fd19c";

function pomoProven(): Brand {
  return {
    id: POMO_ID,
    name: "POMO BUILD",
    slug: "pomobuild",
    site_url: "https://www.pomobuild.ca",
    primary_writer: "proxy",
    proxy_site_token: "site_" + "a".repeat(32),
    proxy_namespace: "guides",
    source_of_truth: {
      confirmed: "platform_proxy",
      confirmed_at: "2026-08-21T00:00:00Z",
      detected: null,
      confidence: null,
      signals: [],
      detected_at: null,
    },
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
        reason: "Editing existing pages needs a CMS connection (WordPress or Shopify).",
        certified_at: null,
        last_execution_id: null,
        fail_count: 0,
      },
    },
  } as Brand;
}

test("default managed namespace is guides", () => {
  expect(DEFAULT_MANAGED_NAMESPACE).toBe("guides");
});

test("managed_pages adapter wraps the proxy platform", () => {
  const meta = websiteAdapterMeta("managed_pages");
  expect(meta.platform).toBe("proxy");
  expect(meta.label).toBe("Volo Managed Pages");
  expect(meta.capabilities).toContain("managed_pages");
});

test("POMO proven proxy state maps to Website connected + Managed Pages available", () => {
  const view = describeWebsiteConnection(pomoProven());
  expect(view.name).toBe("Website connection");
  expect(view.connected).toBe(true);
  expect(view.adapterId).toBe("managed_pages");
  expect(view.adapterLabel).toBe("Volo Managed Pages");
  expect(view.managedNamespace).toBe("guides");
  expect(view.siteHost).toBe("www.pomobuild.ca");

  const managed = view.capabilities.find((c) => c.key === "managed_pages");
  const create = view.capabilities.find((c) => c.key === "create_page");
  const read = view.capabilities.find((c) => c.key === "read_site");
  expect(managed?.status).toBe("available");
  expect(create?.status).toBe("available");
  expect(read?.status).toBe("available");
  expect(view.advanced.primaryWriter).toBe("proxy");
});

test("content strategy picks native blog when WordPress is available", () => {
  expect(
    resolvePublishMethod({
      intent: "blog_post",
      available: ["wordpress", "managed_pages"],
    })
  ).toBe("wordpress");
  expect(
    resolvePublishMethod({
      intent: "blog_post",
      available: ["managed_pages"],
    })
  ).toBe("managed_pages");
  expect(
    resolvePublishMethod({
      intent: "page",
      available: ["managed_pages"],
    })
  ).toBe("managed_pages");
});

test("proxy adapter customer label is Volo Managed Pages", () => {
  const src = fs.readFileSync("lib/execution/adapters/proxy.ts", "utf8");
  expect(src).toMatch(/label: "Volo Managed Pages"/);
  expect(src).toMatch(/provider: "proxy"/);
});

test("connections card is named Website connection", () => {
  const src = fs.readFileSync("lib/connections.ts", "utf8");
  expect(src).toMatch(/name: "Website connection"/);
  expect(src).toMatch(/describeWebsiteConnection/);
  expect(src).toMatch(/websiteCapabilities/);
});
