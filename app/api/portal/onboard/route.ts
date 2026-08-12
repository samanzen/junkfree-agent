import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import type { BusinessModel } from "@/lib/brands";

export const maxDuration = 30;

// Self-serve brand creation for a brand-new customer. Admin brand creation
// stays on POST /api/brands (inactive by default). Here we set active:true so
// the customer can use the portal immediately — rate limits (lib/rateLimit)
// are what protect shared API budget, not an inactive flag.

const BUSINESS_MODELS: BusinessModel[] = [
  "local_service",
  "ecommerce",
  "saas",
  "national_brand",
  "content_publisher",
];

function httpsSiteUrl(raw: unknown): { ok: true; url: string } | { ok: false; error: string } {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "site_url required" };
  }
  const trimmed = raw.trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "site_url must be a valid URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "site_url must use https://" };
  }
  return { ok: true, url: trimmed };
}

function uniqueSlugCandidate(name: string): string {
  const base = slugify(name) || "brand";
  return base;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  if (auth.role === "admin") {
    // Admins create brands from the dashboard so cron eligibility stays explicit.
    return NextResponse.json(
      { error: "Admins create brands from the dashboard, not self-serve onboarding." },
      { status: 400 }
    );
  }

  if (auth.brandId) {
    return NextResponse.json({ error: "Your account already has a brand." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const business_model = body.business_model as BusinessModel;
  const service_area =
    typeof body.service_area === "string" && body.service_area.trim()
      ? body.service_area.trim()
      : null;

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!BUSINESS_MODELS.includes(business_model)) {
    return NextResponse.json(
      { error: `business_model must be one of: ${BUSINESS_MODELS.join(", ")}` },
      { status: 400 }
    );
  }

  const site = httpsSiteUrl(body.site_url);
  if (!site.ok) {
    return NextResponse.json({ error: site.error }, { status: 400 });
  }

  let slug = uniqueSlugCandidate(name);
  let brand: Record<string, unknown> | null = null;
  let lastError: string | null = null;

  // Retry with a short random suffix when the slug is already taken — self-serve
  // users should not have to invent a unique slug themselves.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? slug : `${slug}-${randomBytes(2).toString("hex")}`;
    const { data, error } = await db
      .from("brands")
      .insert({
        name,
        slug: candidate,
        site_url: site.url,
        business_model,
        service_area,
        owner_email: auth.email,
        active: true,
      })
      .select()
      .single();

    if (!error && data) {
      brand = data;
      break;
    }
    if (error?.code === "23505") {
      lastError = "slug already taken";
      continue;
    }
    return NextResponse.json({ error: error?.message || "Could not create brand" }, { status: 500 });
  }

  if (!brand) {
    return NextResponse.json({ error: lastError || "Could not allocate a unique slug" }, { status: 409 });
  }

  const { error: profileErr } = await db
    .from("profiles")
    .update({ brand_id: brand.id })
    .eq("id", auth.id);

  if (profileErr) {
    // Brand row exists but the profile link failed — surface clearly so support
    // can attach brand_id without leaving the customer thinking setup succeeded.
    return NextResponse.json(
      { error: "Brand created but could not link to your account: " + profileErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ brand });
}
