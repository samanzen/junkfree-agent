// GA4 Data API — conversion / lead / call signal pull.
//
// Requires the brand to have connected google_analytics via portal OAuth and
// selected a property. Degrades to null when the token or API fails so the
// portal can still unlock the KPI strip with ga4_pending zeros.

import { accessTokenFor } from "./tokens";
import { readGoogle } from "./store";

export type Ga4Conversions = {
  leads: number;
  calls: number;
  conversions: number;
};

export async function fetchGa4Conversions(
  brandId: string,
  propertyId: string
): Promise<Ga4Conversions | null> {
  const google = await readGoogle(brandId);
  const accountId =
    google.selections.google_analytics?.accountId ||
    google.accounts[google.accounts.length - 1]?.id;
  if (!accountId) return null;

  let accessToken: string;
  try {
    accessToken = await accessTokenFor(brandId, accountId);
  } catch {
    return null;
  }

  // propertyId may be "123" or "properties/123"
  const prop = propertyId.startsWith("properties/")
    ? propertyId
    : `properties/${propertyId}`;

  const body = {
    dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
    metrics: [
      { name: "conversions" },
      { name: "eventCount" },
    ],
    dimensions: [{ name: "eventName" }],
    limit: 50,
  };

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${prop}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  };

  let conversions = 0;
  let leads = 0;
  let calls = 0;
  for (const row of data.rows || []) {
    const event = (row.dimensionValues?.[0]?.value || "").toLowerCase();
    const count = Number(row.metricValues?.[1]?.value || row.metricValues?.[0]?.value || 0) || 0;
    const conv = Number(row.metricValues?.[0]?.value || 0) || 0;
    conversions += conv;
    if (/lead|generate_lead|form_submit|contact/.test(event)) leads += count || conv;
    if (/call|phone|click_to_call/.test(event)) calls += count || conv;
  }

  return { leads, calls, conversions };
}
