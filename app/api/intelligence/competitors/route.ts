import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { rankedKeywords } from "@/lib/dataforseo";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 60;

// GET: list competitors for a brand with keyword gap summary.
// POST: add a new competitor.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const { data: competitors } = await db
    .from("competitors")
    .select("*")
    .eq("brand_id", brandId)
    .eq("active", true)
    .order("added_at", { ascending: true });

  // Get brand's own tracked keywords for gap analysis
  const { data: brandKeywords } = await db
    .from("tracked_keywords")
    .select("keyword")
    .eq("brand_id", brandId)
    .neq("status", "lost");

  const brandKwSet = new Set((brandKeywords || []).map((k) => k.keyword));

  // For each competitor, compute keyword gap from stored data
  const enriched = (competitors || []).map((c) => ({
    ...c,
    gap_available: !!c.last_keyword_count,
  }));

  return NextResponse.json({
    competitors: enriched,
    brand_keyword_count: brandKwSet.size,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brand_id, domain, name } = await req.json().catch(() => ({}));
  if (!brand_id || !domain) {
    return NextResponse.json({ error: "brand_id and domain required" }, { status: 400 });
  }
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "");

  const { data, error } = await db.from("competitors").upsert({
    brand_id,
    domain: cleanDomain,
    name: name || cleanDomain,
    active: true,
  }, { onConflict: "brand_id,domain" }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, competitor: data });
}
