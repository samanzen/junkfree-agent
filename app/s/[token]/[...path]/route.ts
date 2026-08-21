import { NextRequest } from "next/server";
import { db } from "@/lib/supabase";
import { resolveProxyToken, verifyHost } from "@/lib/proxy/resolve";
import { renderPage, renderNotFound } from "@/lib/proxy/render";
import { isCanarySlug } from "@/lib/execution/certify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const notFound = (body: string) =>
  new Response(body, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "x-proxy-origin": "1",
    },
  });

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string; path: string[] }> }
) {
  const { token, path: parts } = await ctx.params;
  const path = Array.isArray(parts) ? parts : [];

  const brand = await resolveProxyToken(token);
  if (!brand) return notFound("<!doctype html><title>Not found</title>");

  const host = verifyHost(req.headers, brand);
  if (!host) return notFound("<!doctype html><title>Not found</title>");

  // Incoming path must be /{namespace}/{slug...} (rewrite keeps the namespace).
  const [ns, ...rest] = path;
  if (ns !== brand.namespace) return notFound(renderNotFound(brand, host));

  const base = `https://${host}/${brand.namespace}`;

  if (rest.length === 1 && rest[0] === "sitemap.xml") {
    return sitemap(brand.id, base);
  }

  const slug = rest.join("/");
  if (!slug) return notFound(renderNotFound(brand, host));

  const { data: page } = await db
    .from("content")
    .select("slug, title, body, meta_description, published_at, updated_at")
    .eq("brand_id", brand.id)
    .eq("slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();

  if (!page) return notFound(renderNotFound(brand, host));

  const isCanary = isCanarySlug(slug);
  const html = renderPage({
    brand,
    page,
    canonical: `${base}/${slug}`,
    noindex: isCanary,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": isCanary
        ? "no-store"
        : "public, s-maxage=300, stale-while-revalidate=86400",
      ...(isCanary ? { "x-robots-tag": "noindex, nofollow" } : {}),
      "x-proxy-origin": "1",
    },
  });
}

async function sitemap(brandId: string, base: string) {
  const { data } = await db
    .from("content")
    .select("slug, published_at, updated_at")
    .eq("brand_id", brandId)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(5000);

  const urls = (data ?? [])
    .filter((r) => !isCanarySlug(r.slug))
    .map((r) => {
      const lastmod = r.updated_at ?? r.published_at;
      return `  <url><loc>${base}/${encodeURI(r.slug)}</loc>${
        lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""
      }</url>`;
    })
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
    {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, s-maxage=600",
        "x-proxy-origin": "1",
      },
    }
  );
}
