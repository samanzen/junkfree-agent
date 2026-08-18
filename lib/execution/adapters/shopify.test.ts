import { test, expect, vi, afterEach } from "vitest";
import { shopifyAdapter } from "./shopify";
import type { AdapterContext } from "../types";

afterEach(() => {
  vi.unstubAllGlobals();
});

function ctx(over: Partial<AdapterContext> = {}): AdapterContext {
  return {
    brand: {
      id: "b1",
      slug: "test",
      name: "Test",
      site_url: "https://example.com",
      gsc_property: null,
      gbp_location_id: null,
      service_area: null,
      services: null,
      edge: null,
      voice: null,
      competitors: null,
      intent_notes: null,
      auto_publish_meta: false,
      active: true,
      owner_email: null,
      business_model: "ecommerce",
      dataforseo_location_code: null,
      dataforseo_language_code: "en",
    },
    credentials: { accessToken: "shpat_test_token_1234567890" },
    config: { shop: "mystore.myshopify.com", status: "publish" },
    ...over,
  };
}

test("check accepts a real shop.json payload", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ shop: { name: "My Store", domain: "mystore.com" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
  const r = await shopifyAdapter.check(ctx());
  expect(r.ok).toBe(true);
  expect(r.detail).toMatch(/My Store/);
});

test("check rejects a non-shop JSON body", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
  const r = await shopifyAdapter.check(ctx());
  expect(r.ok).toBe(false);
});

test("apply creates a page when none exists", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/pages.json?") && (!init || !init.method || init.method === "GET")) {
      return new Response(JSON.stringify({ pages: [] }), { status: 200 });
    }
    if (String(url).endsWith("/pages.json") && init?.method === "POST") {
      return new Response(
        JSON.stringify({ page: { id: 99, handle: "about", title: "About" } }),
        { status: 201 }
      );
    }
    return new Response("nope", { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);

  const r = await shopifyAdapter.apply(ctx(), {
    type: "upsert_page",
    slug: "about",
    title: "About",
    metaDescription: "About us",
    bodyMarkdown: "# Hello\n\nWorld",
  });
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.remoteId).toBe("99");
    expect(r.url).toMatch(/\/pages\/about/);
  }
});
