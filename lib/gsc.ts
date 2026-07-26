// Google Search Console = the eyes of the autonomous system.
// It tells the orchestrator which pages are underperforming and where the
// "striking distance" opportunities are (queries ranking 5-20).
//
// Auth: a Google Cloud service account with the Search Console API enabled,
// added as a user on the GSC property. Set GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY.
//
// Uses google-auth-library (small) + a direct REST call instead of the full
// `googleapis` package, which is too large and crashes the Vercel build.

import { JWT } from "google-auth-library";
import { BRAND } from "./brand";

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

async function query(dimensions: string[], rowLimit = 250): Promise<QueryRow[]> {
  const jwt = auth();
  const { access_token } = await jwt.authorize();
  const endpoint =
    "https://searchconsole.googleapis.com/webmasters/v3/sites/" +
    encodeURIComponent(BRAND.gscProperty) +
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
    throw new Error(`GSC query failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { rows?: QueryRow[] };
  return data.rows || [];
}

// Queries ranking 5-20 with real impressions: a nudge could move them to page 1.
export async function strikingDistance() {
  const rows = await query(["query", "page"]);
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
export async function lowCtrPages() {
  const rows = await query(["page"]);
  return rows
    .filter((r) => r.impressions >= 100 && r.ctr < 0.02)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15)
    .map((r) => ({ page: r.keys[0], impressions: r.impressions, ctr: r.ctr }));
}
