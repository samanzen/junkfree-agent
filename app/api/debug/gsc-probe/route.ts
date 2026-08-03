// TEMP DIAGNOSTIC ROUTE -- investigates why fullKeywordSync() returns no
// rows for a given GSC property (Pomo Build). Admin-only, read-only,
// no writes. DELETE THIS FILE after the investigation is complete.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireAdmin } from "@/lib/auth";
import { fullKeywordSync } from "@/lib/gsc";
import { JWT } from "google-auth-library";

export const maxDuration = 30;

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const { gsc_property } = await req.json().catch(() => ({}));
  if (!gsc_property) return NextResponse.json({ error: "gsc_property required" }, { status: 400 });

  const result: Record<string, unknown> = { gsc_property };

  // --- Stage 1: raw Search Console API call, replicating lib/gsc.ts's
  // query() exactly, but exposing every intermediate value instead of
  // returning only the final filtered/mapped array. ---
  try {
    const jwt = new JWT({
      email: process.env.GSC_CLIENT_EMAIL,
      key: (process.env.GSC_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const { access_token } = await jwt.authorize();
    result.oauth_authorized = true;

    const endpoint =
      "https://searchconsole.googleapis.com/webmasters/v3/sites/" +
      encodeURIComponent(gsc_property) +
      "/searchAnalytics/query";

    const body = { startDate: daysAgo(28), endDate: daysAgo(1), dimensions: ["query", "page"], rowLimit: 2500 };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    result.http_status = res.status;
    result.http_ok = res.ok;

    const rawText = await res.text();
    let parsed: unknown = rawText;
    try { parsed = JSON.parse(rawText); } catch { /* keep raw text */ }

    if (!res.ok) {
      result.raw_error_response = parsed;
    } else {
      const data = parsed as { rows?: unknown[] };
      result.raw_row_count = data.rows?.length ?? 0;
      result.raw_sample_rows = (data.rows || []).slice(0, 5);
      result.raw_response_keys = Object.keys(data);
    }
  } catch (e) {
    result.stage1_threw = true;
    result.stage1_error = e instanceof Error ? { message: e.message, stack: e.stack } : String(e);
  }

  // --- Stage 2: the actual fullKeywordSync() used by stepRankSync(), for
  // direct comparison against the raw call above. ---
  try {
    const rows = await fullKeywordSync(gsc_property);
    result.fullKeywordSync_row_count = rows.length;
    result.fullKeywordSync_sample = rows.slice(0, 5);
  } catch (e) {
    result.fullKeywordSync_threw = true;
    result.fullKeywordSync_error = e instanceof Error ? { message: e.message, stack: e.stack } : String(e);
  }

  return NextResponse.json(result);
}
