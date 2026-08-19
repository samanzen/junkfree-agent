import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { rankedKeywords, geoOf } from "@/lib/dataforseo";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";

export const maxDuration = 60;

// GET: keyword gap analysis for one competitor (uses DataForSEO).
// DELETE: deactivate a competitor.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;

  const { data: competitor } = await db
    .from("competitors")
    .select("*, brands!inner(id, dataforseo_location_code, dataforseo_language_code)")
    .eq("id", id)
    .single();

  if (!competitor) return NextResponse.json({ error: "not found" }, { status: 404 });

  const competitorBrand = competitor.brands as { id: string; dataforseo_location_code: number | null; dataforseo_language_code: string };
  const brandId = competitorBrand.id;
const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  // Rate limit AFTER authorisation, so an unauthorised caller can never
  // consume a tenant's allowance.
  const limited = await enforceRate(brandId!, "external");
  if (limited) return limited;

  // Brand's own keywords
  const { data: brandKws } = await db
    .from("tracked_keywords")
    .select("keyword, best_position, search_volume")
    .eq("brand_id", brandId)
    .neq("status", "lost");

  const brandKwMap = new Map(
    (brandKws || []).map((k) => [k.keyword.toLowerCase(), k])
  );

  // Competitor's ranked keywords via DataForSEO (confirmed endpoint)
  const competitorKws = await rankedKeywords(competitor.domain, geoOf(competitorBrand)).catch(() => []);

  function enrich(k: (typeof competitorKws)[number]) {
    return {
      keyword: k.keyword,
      url: k.url,
      volume: k.volume,
      position: k.position,
      etv: k.etv,
      cpc: k.cpc,
      competition: k.competition,
      difficulty: k.difficulty,
      brand_position: brandKwMap.get(k.keyword.toLowerCase())?.best_position ?? null,
    };
  }

  // Gap keywords: competitor ranks for these, brand does not
  const gaps = competitorKws
    .filter((k) => k.keyword && !brandKwMap.has(k.keyword.toLowerCase()) && k.position <= 20)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 50)
    .map(enrich);

  // Overlap keywords: both rank for these
  const overlap = competitorKws
    .filter((k) => k.keyword && brandKwMap.has(k.keyword.toLowerCase()))
    .sort((a, b) => {
      const brandA = brandKwMap.get(a.keyword.toLowerCase())?.best_position ?? 999;
      const brandB = brandKwMap.get(b.keyword.toLowerCase())?.best_position ?? 999;
      return brandA - brandB;
    })
    .slice(0, 50)
    .map((k) => ({
      ...enrich(k),
      competitor_position: k.position,
    }));

  // Update last_keyword_count (+ gap/common caches when columns exist)
  const { error: updateErr } = await db.from("competitors").update({
    last_keyword_count: competitorKws.length,
    last_common_keywords: overlap.length,
    last_keyword_gap: gaps.length,
    last_checked_at: new Date().toISOString(),
  }).eq("id", id);

  // If migration 018 is missing, still persist the older columns.
  if (updateErr) {
    await db.from("competitors").update({
      last_keyword_count: competitorKws.length,
      last_checked_at: new Date().toISOString(),
    }).eq("id", id);
  }

  return NextResponse.json({
    competitor: { domain: competitor.domain, name: competitor.name },
    total_competitor_keywords: competitorKws.length,
    gaps,
    overlap,
    gap_count: gaps.length,
    common_count: overlap.length,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const { data: competitor } = await db.from("competitors").select("brand_id").eq("id", id).single();
  if (!competitor) return NextResponse.json({ error: "not found" }, { status: 404 });
const accessErr = requireBrandAccess(auth, competitor.brand_id);
  if (accessErr) return accessErr;

  // Rate limit AFTER authorisation, so an unauthorised caller can never
  // consume a tenant's allowance.
  const limited = await enforceRate(competitor.brand_id!, "external");
  if (limited) return limited;

  await db.from("competitors").update({ active: false }).eq("id", id);
  return NextResponse.json({ ok: true });
}
