import { expect, test, afterEach } from "vitest";
import fs from "fs";
import { verifyHost, resolvePublicHost, clearProxyTokenCache, type ProxyBrand } from "./resolve";
import { renderPage, renderNotFound, resolveMetaDescription } from "./render";

afterEach(() => clearProxyTokenCache());

const read = (p: string) => fs.readFileSync(p, "utf8");

const brand: ProxyBrand = {
  id: "b1",
  slug: "acme",
  name: "Acme Co",
  site_url: "https://www.acme.example",
  namespace: "guides",
  primary_writer: "proxy",
};

test("migration 023 adds meta_description and updated_at", () => {
  const sql = read("supabase/023_content_meta.sql");
  expect(sql).toMatch(/meta_description text/);
  expect(sql).toMatch(/updated_at timestamptz/);
  expect(sql).toMatch(/content_brand_published_idx/);
});

test("verifyHost accepts www/non-www match and rejects foreign hosts", () => {
  expect(verifyHost(new Headers({ "x-forwarded-host": "acme.example" }), brand)).toBe("acme.example");
  expect(verifyHost(new Headers({ host: "www.acme.example" }), brand)).toBe("www.acme.example");
  expect(verifyHost(new Headers({ "x-forwarded-host": "evil.example" }), brand)).toBeNull();
});

test("resolvePublicHost falls back to site_url when Vercel rewrite sends app host", () => {
  expect(resolvePublicHost(new Headers({ host: "pub.volohub.com" }), brand)).toBe("www.acme.example");
  expect(resolvePublicHost(new Headers({ "x-forwarded-host": "www.acme.example" }), brand)).toBe(
    "www.acme.example"
  );
});

test("renderPage emits canonical on the customer host and noindexes canaries", () => {
  const html = renderPage({
    brand,
    page: {
      slug: "seo-cert-abcd1234",
      title: "Publishing test CT-x",
      body: "Hello **world**\n\nCB-token",
      meta_description: "A short description",
      published_at: "2026-08-21T00:00:00Z",
      updated_at: "2026-08-21T00:00:00Z",
    },
    canonical: "https://acme.example/guides/seo-cert-abcd1234",
    noindex: true,
  });
  expect(html).toMatch(/rel="canonical" href="https:\/\/acme\.example\/guides\/seo-cert-abcd1234"/);
  expect(html).toMatch(/og:url/);
  expect(html).toMatch(/noindex/);
  expect(html).toMatch(/<strong>world<\/strong>/);
  expect(html).not.toMatch(/pub\./);
});

test("meta falls back from body TITLE/META lines when column empty", () => {
  expect(
    resolveMetaDescription({
      slug: "x",
      title: "T",
      body: "META: From front matter\n\nBody text here",
      meta_description: null,
      published_at: null,
      updated_at: null,
    })
  ).toBe("From front matter");
});

test("not-found is a real 404 body with noindex", () => {
  const html = renderNotFound(brand, "acme.example");
  expect(html).toMatch(/noindex/);
  expect(html).toMatch(/Page not found/);
});

test("public origin route exists and validates namespace; host falls back for Vercel rewrites", () => {
  const src = read("app/s/[token]/[...path]/route.ts");
  expect(src).toMatch(/resolveProxyToken/);
  expect(src).toMatch(/resolvePublicHost/);
  expect(src).toMatch(/sitemap\.xml/);
  expect(src).toMatch(/ns !== brand\.namespace/);
  expect(src).toMatch(/isCanarySlug/);
});

test("Approve writes meta_description and updated_at via contentPublishFields", () => {
  expect(read("app/api/drafts/[id]/approve/route.ts")).toMatch(/contentPublishFields/);
  expect(read("lib/content-publish.ts")).toMatch(/meta_description/);
  expect(read("lib/content-publish.ts")).toMatch(/updated_at/);
});
