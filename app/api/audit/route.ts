import { NextRequest, NextResponse } from "next/server";
import { safeFetchPage } from "@/lib/audit/url";
import { extractFacts, runChecks, scoreChecks } from "@/lib/audit/onpage";
import { buildReport } from "@/lib/audit/report";
import { clientKeyFrom, consumeAnonAudit, anonLimitMessage } from "@/lib/audit/limit";

export const maxDuration = 30;

// PUBLIC SITE AUDIT — the front door of the funnel.
//
// This is the ONLY route in the product that does work without authentication,
// which makes it the only one that needs to defend itself rather than lean on
// requireAuth. Three guards, in this order:
//
//   1. Abuse limit first, by hashed client key, BEFORE any outbound request.
//      Checking after the fetch would mean a blocked caller had already spent
//      our egress, which defeats the purpose of the limit.
//   2. SSRF validation inside safeFetchPage: scheme, port, credentials, and
//      every resolved IP on every redirect hop. See lib/audit/url.ts.
//   3. A hard size and time cap on the response we read back.
//
// The audit itself is deliberately ONE page (whatever the URL resolves to).
// A full crawl is minutes of work and is what the account is for; doing it
// anonymously would be both slow and an easy way to make us someone's scanner.

export async function POST(req: NextRequest) {
  const limit = await consumeAnonAudit(clientKeyFrom(req.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: anonLimitMessage(limit), retry_at: limit.resetAt },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            limit.resetAt
              ? Math.max(1, Math.ceil((Date.parse(limit.resetAt) - Date.now()) / 1000))
              : 900,
          ),
        },
      },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  const raw = typeof body.url === "string" ? body.url : "";
  if (!raw.trim()) {
    return NextResponse.json({ error: "Enter your website address." }, { status: 400 });
  }
  if (raw.length > 300) {
    return NextResponse.json({ error: "That address is too long." }, { status: 400 });
  }

  const fetched = await safeFetchPage(raw);
  if (!fetched.ok) {
    // 400 rather than 5xx: with one exception these are all problems with the
    // submitted address, and the visitor can act on the message.
    return NextResponse.json({ error: fetched.message, reason: fetched.reason }, { status: 400 });
  }

  const facts = extractFacts(fetched.html, fetched.finalUrl, fetched.elapsedMs);
  const checks = runChecks(facts);
  const report = buildReport({
    url: raw.trim(),
    finalUrl: fetched.finalUrl,
    checks,
    score: scoreChecks(checks),
  });

  return NextResponse.json({ report });
}
