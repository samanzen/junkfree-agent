import { test, expect, vi, afterEach } from "vitest";
import { shopifyAdapter, shopHost, shopifyPageGid, SHOPIFY_ADMIN_API_VERSION } from "./shopify";
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

function gqlResponse(data: unknown, status = 200, errors?: unknown) {
  return new Response(JSON.stringify(errors ? { data, errors } : { data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("shopHost normalises a bare store name", () => {
  expect(shopHost(ctx({ config: { shop: "MyStore" } }))).toBe("mystore.myshopify.com");
  expect(shopHost(ctx({ config: { shop: "https://mystore.myshopify.com/" } }))).toBe("mystore.myshopify.com");
  expect(shopHost(ctx({ config: { shop: "not a shop!!" } }))).toBeNull();
});

test("numeric REST leftovers become GraphQL GIDs", () => {
  expect(shopifyPageGid("99")).toBe("gid://shopify/Page/99");
  expect(shopifyPageGid("gid://shopify/Page/99")).toBe("gid://shopify/Page/99");
});

test("requests pin GraphQL Admin API 2026-07, not REST 2024-10", async () => {
  const fetchMock = vi.fn(async (url: string) => {
    expect(String(url)).toContain(`/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`);
    expect(String(url)).not.toContain("2024-10");
    expect(String(url)).not.toContain("/shop.json");
    return gqlResponse({ shop: { name: "My Store", primaryDomain: { host: "example.com", url: "https://example.com" } } });
  });
  vi.stubGlobal("fetch", fetchMock);
  await shopifyAdapter.check(ctx());
  expect(fetchMock).toHaveBeenCalled();
});

test("check accepts a real GraphQL shop payload", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      gqlResponse({ shop: { name: "My Store", primaryDomain: { host: "example.com", url: "https://example.com" } } })
    )
  );
  const r = await shopifyAdapter.check(ctx());
  expect(r.ok).toBe(true);
  expect(r.detail).toMatch(/My Store/);
});

test("check rejects HTTP 200 that is not data.shop", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => gqlResponse({ ok: true })));
  const r = await shopifyAdapter.check(ctx());
  expect(r.ok).toBe(false);
});

test("check explains a token that cannot write content", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      gqlResponse(null, 200, [{ message: "Access denied", extensions: { code: "ACCESS_DENIED" } }])
    )
  );
  const r = await shopifyAdapter.check(ctx());
  expect(r.ok).toBe(false);
  expect(r.detail).toMatch(/write content/i);
  expect(r.detail).not.toMatch(/GraphQL|OAuth|scope/i);
});

test("apply creates a page when none exists", async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}")) as { query?: string };
    if (body.query?.includes("pages(")) return gqlResponse({ pages: { nodes: [] } });
    if (body.query?.includes("pageCreate")) {
      return gqlResponse({
        pageCreate: { page: { id: "gid://shopify/Page/99", handle: "about", title: "About" }, userErrors: [] },
      });
    }
    return new Response("nope", { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);

  const r = await shopifyAdapter.apply(ctx(), pageChange);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.remoteId).toBe("gid://shopify/Page/99");
  expect(r.url).toBe("https://example.com/pages/about");
});

test("HTTP 200 with userErrors is a failed write", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as { query?: string };
      if (body.query?.includes("pages(")) return gqlResponse({ pages: { nodes: [] } });
      return gqlResponse({
        pageCreate: { page: null, userErrors: [{ message: "Handle already taken" }] },
      });
    })
  );
  const r = await shopifyAdapter.apply(ctx(), pageChange);
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.error).toMatch(/Handle already taken/);
});

test("apply updates an existing page and captures previous", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as { query?: string };
      if (body.query?.includes("pages(")) {
        return gqlResponse({
          pages: { nodes: [{ id: "gid://shopify/Page/7", handle: "about", title: "Old", body: "<p>old</p>" }] },
        });
      }
      if (body.query?.includes("pageUpdate")) {
        return gqlResponse({
          pageUpdate: { page: { id: "gid://shopify/Page/7", handle: "about" }, userErrors: [] },
        });
      }
      return new Response("nope", { status: 500 });
    })
  );
  const r = await shopifyAdapter.apply(ctx(), pageChange);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.previous).toMatchObject({ title: "Old" });
});

test("delete_page uses pageDelete with a GID", async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}")) as { query?: string; variables?: { id?: string } };
    expect(body.query).toMatch(/pageDelete/);
    expect(body.variables?.id).toBe("gid://shopify/Page/99");
    return gqlResponse({ pageDelete: { deletedPageId: "gid://shopify/Page/99", userErrors: [] } });
  });
  vi.stubGlobal("fetch", fetchMock);
  const r = await shopifyAdapter.apply(ctx(), {
    type: "delete_page",
    slug: "seo-cert-abc",
    remoteId: "99",
  });
  expect(r.ok).toBe(true);
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
