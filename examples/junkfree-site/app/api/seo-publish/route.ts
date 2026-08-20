// Copy this file into junkfree-site as: app/api/seo-publish/route.ts
//
// This repo cannot push to junkfree-site. Portal → Connections → "Your own
// website" signs POSTs with X-Signature-256. On junkfree-site this route
// verifies that signature and writes approved pages into the `content` table
// the Next.js site already reads.
//
// Vercel env on junkfree-site: SEO_PUBLISH_SECRET = the secret shown in
// Connections (must match). junkfree.ca must serve that Next app, not the
// old Vite site, or Connect will keep seeing the public homepage.

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function valid(body: string, header: string) {
  const secret = process.env.SEO_PUBLISH_SECRET || "";
  if (!secret) return false;
  const given = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

type Change = {
  type?: string;
  slug?: string;
  title?: string;
  bodyMarkdown?: string;
  url?: string;
  metaDescription?: string | null;
  remoteId?: string | null;
};

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!valid(raw, req.headers.get("x-signature-256") || "")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: { event?: string; site?: string; change?: Change };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  if (payload.event === "check") {
    return NextResponse.json({ ok: true, protocolVersion: 1, capabilities: ["upsert_page"] });
  }

  if (payload.event === "apply") {
    const change = payload.change || {};
    if (change.type === "upsert_page" && change.slug && change.title && change.bodyMarkdown) {
      const written = await writePage(change.slug, change.title, change.bodyMarkdown);
      if (!written.ok) {
        return NextResponse.json({ ok: false, error: written.error }, { status: 500 });
      }
      const site = (payload.site || "").replace(/\/+$/, "");
      return NextResponse.json({
        ok: true,
        created: true,
        remoteId: change.slug,
        url: site ? `${site}/${change.slug}` : `/${change.slug}`,
      });
    }
    if (change.type === "delete_page") {
      const slug = change.slug || change.remoteId;
      if (!slug) return NextResponse.json({ ok: false, error: "missing slug" }, { status: 422 });
      const deleted = await deletePage(slug);
      if (!deleted.ok) {
        return NextResponse.json({ ok: false, error: deleted.error }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }
    if (change.type === "update_meta" && change.url) {
      return NextResponse.json(
        { ok: false, error: "This site applies new pages; title-only updates are not stored." },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: false, error: "unsupported change" }, { status: 422 });
  }

  return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
}

async function writePage(
  slug: string,
  title: string,
  body: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "content store is not configured" };
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: brand, error: brandErr } = await db
      .from("brands")
      .select("id")
      .eq("slug", "junkfree")
      .maybeSingle();
    if (brandErr || !brand?.id) {
      return { ok: false, error: "brand not found" };
    }
    const { error } = await db.from("content").upsert(
      {
        slug,
        brand_id: brand.id,
        title,
        body,
        published_at: new Date().toISOString(),
      },
      { onConflict: "brand_id,slug" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function deletePage(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "content store is not configured" };
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: brand, error: brandErr } = await db
      .from("brands")
      .select("id")
      .eq("slug", "junkfree")
      .maybeSingle();
    if (brandErr || !brand?.id) {
      return { ok: false, error: "brand not found" };
    }
    const { error } = await db.from("content").delete().eq("brand_id", brand.id).eq("slug", slug);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
