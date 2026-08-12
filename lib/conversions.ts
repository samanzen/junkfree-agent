// Conversion signals — unlock portal leads / calls / conversions.
//
// When GA4 is connected we attempt a real Data API pull. Until the property
// token + measurement id path is fully verified for a brand, we still write a
// row sourced from connected state so the portal can unlock the KPI strip
// honestly (zeros with source=ga4_pending) rather than leaving a permanent lock.

import { db } from "./supabase";
import type { Brand } from "./brands";
import { readGoogle } from "./google/store";
import { fetchGa4Conversions } from "./google/ga4";

const MISSING = new Set(["PGRST205", "42P01"]);

export type ConversionSnapshot = {
  leads: number | null;
  calls: number | null;
  conversions: number | null;
  source: string;
  connected: boolean;
};

export async function latestConversions(brandId: string): Promise<ConversionSnapshot | null> {
  const { data, error } = await db
    .from("conversion_signals")
    .select("leads, calls, conversions, source, captured_at")
    .eq("brand_id", brandId)
    .order("captured_at", { ascending: false })
    .limit(1);
  if (error || !data?.[0]) return null;
  const row = data[0];
  return {
    leads: row.leads,
    calls: row.calls,
    conversions: row.conversions,
    source: row.source,
    connected: true,
  };
}

export async function captureConversionSignals(brand: Brand): Promise<ConversionSnapshot | null> {
  const google = await readGoogle(brand.id).catch(() => null);
  const ga = google?.selections?.google_analytics;
  if (!ga?.resourceId) {
    return null;
  }

  const propertyId = String(ga.resourceId);
  const live = propertyId
    ? await fetchGa4Conversions(brand.id, propertyId).catch(() => null)
    : null;

  const row = {
    brand_id: brand.id,
    period_start: new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
    leads: live?.leads ?? 0,
    calls: live?.calls ?? 0,
    conversions: live?.conversions ?? 0,
    source: live ? "ga4" : "ga4_pending",
    captured_at: new Date().toISOString(),
  };

  const { error } = await db.from("conversion_signals").insert(row);
  if (error && !MISSING.has((error as { code?: string }).code || "")) {
    console.warn("[conversions] persist failed:", error.message);
  }

  return {
    leads: row.leads,
    calls: row.calls,
    conversions: row.conversions,
    source: row.source,
    connected: true,
  };
}
