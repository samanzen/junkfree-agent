import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { rankedKeywords } from "@/lib/dataforseo";

export const maxDuration = 60;

// GET: keyword gap analysis for one competitor (uses DataForSEO).
// DELETE: deactivate a competitor.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: competitor } = await db
    .from("competitors")
    .select("*, brands!inner(id)")
    .eq("id", id)
    .single();

  if (!competitor) return NextResponse.json({ error: "not found" }, { status: 404 });

  const brandId = (competitor.brands as { id: string }).id;

  // Brand's own keywords
  const { data: brandKws } = await db
    .from("tracked_keywords")
    .select("keyword, best_position, search_volume")
    .eq("brand_id", brandId)
    .neq("status", "lost");

  const brandKwMap = new Map((brandKws || []).map((k) => [k.keyword, k]));

  // Competitor's ranked keywords via DataForSEO (confirmed endpoint)
  const competitorKws = await rankedKeywords(competitor.domain).catch(() => []);

  // Gap keywords: competitor ranks for these, brand does not
  const gaps = competitorKws
    .filter((k) => k.keyword && !brandKwMap.has(k.keyword) && k.position <= 20)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 30);

  // Overlap keywords: both rank for these
  const overlap = competitorKws
    .filter((k) => k.keyword && brandKwMap.has(k.keyword))
    .map((k) => ({
      keyword: k.keyword,
      competitor_position: k.position,
      brand_position: brandKwMap.get(k.keyword)?.best_position ?? null,
      volume: k.volume,
    }))
    .sort((a, b) => (a.brand_position || 999) - (b.brand_position || 999))
    .slice(0, 20);

  // Update last_keyword_count
  await db.from("competitors").update({
    last_keyword_count: competitorKws.length,
    last_checked_at: new Date().toISOString(),
  }).eq("id", id);

  return NextResponse.json({
    competitor: { domain: competitor.domain, name: competitor.name },
    total_competitor_keywords: competitorKws.length,
    gaps,
    overlap,
    gap_count: gaps.length,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.from("competitors").update({ active: false }).eq("id", id);
  return NextResponse.json({ ok: true });
}
