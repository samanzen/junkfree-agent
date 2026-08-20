// THE ONE CODED-SITE RECEIVER.
//
// Custom-coded sites (Next.js, etc.) do not get a bespoke last mile. They
// paste this snippet once, drop in the secret we generated, deploy, then
// paste the HTTPS address on Connections. After that, Approve pushes live
// through the existing webhook adapter.
//
// This file is the snippet source of truth. The Connections panel renders it;
// tests pin that it verifies X-Signature-256 the same way the adapter signs.

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
    change?: {
      type?: string;
      slug?: string;
      title?: string;
      bodyMarkdown?: string;
      url?: string;
      metaDescription?: string | null;
    };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  if (payload.event === "check") {
    return NextResponse.json({ ok: true });
  }

  if (payload.event === "apply") {
    // Write payload.change into your content store, then return the live URL.
    const slug = payload.change?.slug;
    return NextResponse.json({
      ok: true,
      url: slug ? \`/\${slug}\` : payload.change?.url || null,
    });
  }

  return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
}
`;

export function codedSiteSnippet(secret: string): string {
  const trimmed = (secret || "").trim();
  if (!trimmed) return CODED_SITE_SNIPPET;
  return CODED_SITE_SNIPPET.split(CODED_SITE_SECRET_PLACEHOLDER).join(trimmed);
}
