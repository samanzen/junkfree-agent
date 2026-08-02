// Google Search Console = the eyes of the autonomous system.
// Brand-aware: takes a GSC property so one engine reads data for every brand.
//
// Auth: a Google Cloud service account with the Search Console API enabled,
// added as a user on each brand's GSC property (GSC_CLIENT_EMAIL/GSC_PRIVATE_KEY).
// Uses google-auth-library (small) + a direct REST call.

import { JWT } from "google-auth-library";

function auth() {
  return new JWT({
    email: process.env.GSC_CLIENT_EMAIL,
    key: (process.env.GSC_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export type QueryRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

async function query(gscProperty: string, dimensions: string[], rowLimit = 250): Promise<QueryRow[]> {
  const jwt = auth();
  const { access_token } = await jwt.authorize();
  const endpoint =
    "https://searchconsole.googleapis.com/webmasters/v3/sites/" +
    encodeURIComponent(gscProperty) +
    "/searchAnalytics/query";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: daysAgo(28),
      endDate: daysAgo(1),
      dimensions,
      rowLimit,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    // TEMP DIAGNOSTIC (rank-sync silent-swallow investigation) -- remove once root cause confirmed.
    let parsedError: unknown = errorText;
    try { parsedError = JSON.parse(errorText); } catch { /* not JSON, keep raw text */ }
    console.error("[gsc diagnostic] search console request failed", {
      gsc_property: gscProperty,
      status: res.status,
      error: parsedError,
    });
    throw new Error(`GSC query failed: ${res.status} ${errorText}`);
  }
  const data = (await res.json()) as { rows?: QueryRow[] };
  return data.rows || [];
}

// Queries ranking 5-20 with real impressions: a nudge could move them to page 1.
export async function strikingDistance(gscProperty: string) {
  const rows = await query(gscProperty, ["query", "page"]);
  return rows
    .filter((r) => r.position >= 5 && r.position <= 20 && r.impressions >= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25)
    .map((r) => ({
      keyword: r.keys[0],
      page: r.keys[1],
      impressions: r.impressions,
      position: Math.round(r.position * 10) / 10,
      ctr: r.ctr,
    }));
}

// Pages with lots of impressions but poor CTR: usually a weak title/meta.
export async function lowCtrPages(gscProperty: string) {
  const rows = await query(gscProperty, ["page"]);
  return rows
    .filter((r) => r.impressions >= 100 && r.ctr < 0.02)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15)
    .map((r) => ({ page: r.keys[0], impressions: r.impressions, ctr: r.ctr }));
}

// Pages ranking for queries that may signal wrong intent (e.g. "free"), so the
// intent-fixer can qualify them. Returns page -> the queries bringing it traffic.
export async function pagesByIntentSignal(gscProperty: string, signal: string) {
  const rows = await query(gscProperty, ["query", "page"]);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    if (r.keys[0]?.toLowerCase().includes(signal.toLowerCase()) && r.impressions >= 20) {
      const page = r.keys[1];
      if (!map.has(page)) map.set(page, []);
      map.get(page)!.push(r.keys[0]);
    }
  }
  return [...map.entries()].map(([page, queries]) => ({ page, queries })).slice(0, 10);
}

// ── Sprint 4: Position Tracking additions ────────────────────────────────────

// Full keyword sync: all ranked keywords with complete GSC data.
// Used by the rank_sync job to populate tracked_keywords + keyword_positions.
// Fetches the last 28 days (GSC's standard window). rowLimit 2500 covers most sites.
export async function fullKeywordSync(gscProperty: string, rowLimit = 2500): Promise<{
  keyword: string;
  page: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
}[]> {
  const rows = await query(gscProperty, ["query", "page"], rowLimit);
  return rows
    .filter((r) => r.position > 0 && r.impressions > 0)
    .map((r) => ({
      keyword: r.keys[0],
      page: r.keys[1],
      position: Math.round(r.position * 10) / 10,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
    }));
}

// Page-level performance: aggregated GSC data per landing page.
// Used for the content performance module.
export async function pagePerformanceSummary(gscProperty: string): Promise<{
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}[]> {
  const rows = await query(gscProperty, ["page"], 1000);
  return rows
    .filter((r) => r.impressions > 0)
    .sort((a, b) => b.clicks - a.clicks)
    .map((r) => ({
      page: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: Math.round(r.position * 10) / 10,
    }));
}

// Daily position history for a single keyword over a date range.
// Uses the "date" + "query" dimensions with a date filter.
// This enables the per-keyword history charts in the keyword drawer.
export async function keywordDailyHistory(
  gscProperty: string,
  keyword: string,
  startDate: string,
  endDate: string
): Promise<{ date: string; position: number; clicks: number; impressions: number; ctr: number }[]> {
  const jwt = auth();
  const { access_token } = await jwt.authorize();
  const endpoint =
    "https://searchconsole.googleapis.com/webmasters/v3/sites/" +
    encodeURIComponent(gscProperty) +
    "/searchAnalytics/query";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["date"],
      dimensionFilterGroups: [{
        filters: [{ dimension: "query", operator: "equals", expression: keyword }],
      }],
      rowLimit: 500,
    }),
  });
  if (!res.ok) throw new Error(`GSC daily history failed: ${res.status}`);
  const data = (await res.json()) as { rows?: QueryRow[] };
  return (data.rows || []).map((r) => ({
    date: r.keys[0],
    position: Math.round(r.position * 10) / 10,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
  }));
}
