import { NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { db } from "@/lib/supabase";
import { domainOverview, backlinksSummary, isConfigured } from "@/lib/dataforseo";

export const maxDuration = 60;

export async function GET() {
  const brands = await getActiveBrands().catch((e) => ({ error: String(e) }));
  if (!Array.isArray(brands)) return NextResponse.json({ step: "getActiveBrands", error: brands });
  const brand = brands[0];
  if (!brand) return NextResponse.json({ step: "no brands found" });

  const domain = brand.site_url.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "");
  const dfConfigured = isConfigured();

  let overview = null, overviewErr = null;
  let backlinks = null, backlinksErr = null;
  if (dfConfigured) {
    try { overview = await domainOverview(domain); } catch (e) { overviewErr = String(e); }
    try { backlinks = await backlinksSummary(domain); } catch (e) { backlinksErr = String(e); }
  }

  let insertErr = null;
  const { error } = await db.from("metric_snapshots").insert({
    brand_id: brand.id,
    organic_traffic: overview?.organic_traffic ?? 99,
    organic_keywords: overview?.organic_keywords ?? 88,
    backlinks: backlinks?.backlinks ?? 77,
    referring_domains: backlinks?.referring_domains ?? 66,
    captured_at: new Date().toISOString(),
  });
  insertErr = error?.message ?? null;

  return NextResponse.json({
    brand: brand.name,
    dataforseo_configured: dfConfigured,
    overview, overviewErr,
    backlinks, backlinksErr,
    insertErr,
  });
}
