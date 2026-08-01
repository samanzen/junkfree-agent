import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireAdmin } from "@/lib/auth";
import type { BusinessModel } from "@/lib/brands";

export const maxDuration = 30;

// Admin-only brand administration surface (Sprint 6.3 Phase 1) — separate
// from /api/platform, which serves the dashboard's data-loading needs, not
// tenant creation. Replaces the previous "SQL editor only" way of adding a
// brand. Minimal field set by design: everything not captured here (voice,
// edge, competitors, intent_notes, DataForSEO geography overrides, revenue
// config) keeps its existing column default/null and is edited later.
const BUSINESS_MODELS: BusinessModel[] = ["local_service", "ecommerce", "saas", "national_brand", "content_publisher"];
const SLUG_RE = /^[a-z0-9-]+$/;

// List every brand (active and inactive) for the admin Brands view.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const { data, error } = await db.from("brands").select("*").order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ brands: data || [] });
}

// Create a new brand. Body: { name, slug, site_url, business_model, gsc_property? }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const { name, slug, site_url, business_model, gsc_property } = await req.json().catch(() => ({}));

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!site_url || typeof site_url !== "string") {
    return NextResponse.json({ error: "site_url required" }, { status: 400 });
  }
  if (!slug || typeof slug !== "string" || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "slug required, lowercase letters/numbers/hyphens only" }, { status: 400 });
  }
  if (!BUSINESS_MODELS.includes(business_model)) {
    return NextResponse.json({ error: `business_model must be one of: ${BUSINESS_MODELS.join(", ")}` }, { status: 400 });
  }

  const { data, error } = await db
    .from("brands")
    .insert({
      name,
      slug,
      site_url,
      business_model,
      gsc_property: gsc_property || null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = Postgres unique_violation -- brands.slug is unique, so this is
    // the "slug already taken" case, not an unexpected failure.
    if (error.code === "23505") {
      return NextResponse.json({ error: "slug already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, brand: data });
}
