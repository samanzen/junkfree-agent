// THE ONE CODED-SITE RECEIVER.
//
// Custom-coded sites (Next.js, etc.) do not get a bespoke last mile. They
// paste this snippet once, drop in the secret we generated, deploy, then
// paste the HTTPS address on Connections. After that, Approve pushes live
// through the existing webhook adapter.
//
// This file is the snippet source of truth. The Connections panel renders it;
// tests pin that it verifies X-Signature-256 the same way the adapter signs.
//
// Slice 1: a receiver that only returns {ok:true} cannot become certified.
// The snippet must persist upsert_page, return an absolute url, and delete
// the same resource on delete_page. Do not advertise operations it does not
// implement.

export const CODED_SITE_SECRET_PLACEHOLDER = "YOUR_SECRET";

export const CODED_SITE_SNIPPET = `// app/api/seo-publish/route.ts
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SECRET = "${CODED_SITE_SECRET_PLACEHOLDER}";

function valid(body: string, header: string) {
  const given = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!valid(raw, req.headers.get("x-signature-256") || "")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: {
    event?: string;
    site?: string;
    change?: {
      type?: string;
      slug?: string;
      title?: string;
      bodyMarkdown?: string;
      url?: string;
      metaDescription?: string | null;
      remoteId?: string | null;
    };
  };
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
    const site = (payload.site || "").replace(/\\/+$/, "");

    if (change.type === "upsert_page") {
      // Persist change.slug / title / bodyMarkdown in YOUR content store.
      // Returning ok without writing will not prove publishing.
      const slug = change.slug;
      const url = slug ? (site ? \`\${site}/\${slug}\` : \`/\${slug}\`) : null;
      return NextResponse.json({ ok: true, url, created: true, remoteId: slug || null });
    }

    if (change.type === "delete_page") {
      // Delete the page you created for slug or remoteId.
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "unsupported change" }, { status: 422 });
  }

  return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
}
`;

export function codedSiteSnippet(secret: string): string {
  const trimmed = (secret || "").trim();
  if (!trimmed) return CODED_SITE_SNIPPET;
  return CODED_SITE_SNIPPET.split(CODED_SITE_SECRET_PLACEHOLDER).join(trimmed);
}
