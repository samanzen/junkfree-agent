import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";
import { getBrandById } from "@/lib/brands";
import { isTrackableCompetitor, normalizeCompetitorDomain } from "@/lib/competitors/filter";
import { resolveCompetitorInput } from "@/lib/competitors/resolve";

export const maxDuration = 60;

// GET: list competitors for a brand with keyword gap summary.
// POST: add a new competitor (accepts a domain OR a business name).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  // Rate limit AFTER authorisation, so an unauthorised caller can never
  // consume a tenant's allowance.
  const limited = await enforceRate(brandId!, "external");
  if (limited) return limited;

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

  const body = await req.json().catch(() => ({}));
  const { brand_id, domain, name, confirm } = body as {
    brand_id?: string;
    domain?: string;
    name?: string;
    /** When true, skip did-you-mean and add `domain` as typed (after user picked a suggestion). */
    confirm?: boolean;
  };
  if (!brand_id || !domain) {
    return NextResponse.json({ error: "brand_id and domain required" }, { status: 400 });
  }
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  // Rate limit AFTER authorisation, so an unauthorised caller can never
  // consume a tenant's allowance.
  const limited = await enforceRate(brand_id!, "external");
  if (limited) return limited;

  const brand = await getBrandById(brand_id);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  let cleanDomain: string;

  if (confirm) {
    cleanDomain = normalizeCompetitorDomain(domain);
    if (!isTrackableCompetitor(cleanDomain, brand.site_url)) {
      return NextResponse.json(
        {
          error:
            "That isn’t a competitor site. Add another business in your industry — not Facebook, Yelp, or a directory.",
        },
        { status: 400 }
      );
    }
  } else {
    const resolved = await resolveCompetitorInput(domain, brand);
    if (resolved.kind === "empty") {
      return NextResponse.json({ error: resolved.message }, { status: 400 });
    }
    if (resolved.kind === "suggestions") {
      return NextResponse.json({
        needs_confirmation: true,
        query: resolved.query,
        suggestions: resolved.suggestions,
        message: `Did you mean one of these sites for “${resolved.query}”?`,
      });
    }
    cleanDomain = resolved.domain;
  }

  const { data, error } = await db
    .from("competitors")
    .upsert(
      {
        brand_id,
        domain: cleanDomain,
        name: name || cleanDomain,
        active: true,
      },
      { onConflict: "brand_id,domain" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, competitor: data, resolved_domain: cleanDomain });
}
