import { test, expect, vi, afterEach } from "vitest";
import { shopifyAdapter, shopHost } from "./shopify";
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
    } as AdapterContext["brand"],
    credentials: { accessToken: "shpat_test_token_1234567890" },
    config: { shop: "mystore.myshopify.com", status: "publish" },
    ...over,
  };
}

const pageChange = {
  type: "upsert_page" as const,
  slug: "about",
  title: "About",
  metaDescription: "Who we are.",
  bodyMarkdown: "# About\n\nHello.",
};

test("shopHost normalises a bare store name", () => {
  expect(shopHost(ctx({ config: { shop: "MyStore" } }))).toBe("mystore.myshopify.com");
  expect(shopHost(ctx({ config: { shop: "https://mystore.myshopify.com/" } }))).toBe("mystore.myshopify.com");
  expect(shopHost(ctx({ config: { shop: "not a shop!!" } }))).toBeNull();
});

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

  const r = await shopifyAdapter.apply(ctx(), pageChange);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.remoteId).toBe("99");
  expect(r.url).toBe("https://mystore.myshopify.com/pages/about");
});

test("apply updates an existing page and captures previous", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/pages.json?")) {
        return new Response(
          JSON.stringify({ pages: [{ id: 7, handle: "about", title: "Old", body_html: "<p>old</p>" }] }),
          { status: 200 }
        );
      }
      if (String(url).includes("/pages/7.json") && init?.method === "PUT") {
        return new Response(JSON.stringify({ page: { id: 7, handle: "about" } }), { status: 200 });
      }
      return new Response("nope", { status: 500 });
    })
  );
  const r = await shopifyAdapter.apply(ctx(), pageChange);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.previous).toMatchObject({ title: "Old" });
});

test("apply refuses update_meta rather than guessing theme metafields", async () => {
  const r = await shopifyAdapter.apply(ctx(), {
    type: "update_meta",
    url: "https://mystore.com/pages/about",
    title: "X",
    metaDescription: "Y",
  });
  expect(r.ok).toBe(false);
});
