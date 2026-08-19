// Shared gate for Vercel Cron endpoints.
//
// Every cron route previously compared the Authorization header to
// `Bearer ${process.env.CRON_SECRET}` with a plain string equality. When
// CRON_SECRET is unset that becomes `Bearer undefined`; when it is empty,
// `Bearer `. Either comparison succeeds against a matching request, so an
// unconfigured deployment would let anyone trigger every brand's full AI /
// DataForSEO pipeline.
//
// Fail CLOSED: a missing or empty secret is a 401, never a free pass. The
// comparison itself is timing-safe so a secret that IS set cannot be
// recovered one byte at a time from response latency.

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Returns null when the request carries a valid cron bearer token, or the
 * 401 response to send back. Callers read exactly like requireAuth:
 *
 *   const cronErr = requireCronSecret(req);
 *   if (cronErr) return cronErr;
 */
export function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cronAuth] CRON_SECRET is not set — refusing every cron request");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const header = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on unequal lengths; treat that as a mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
