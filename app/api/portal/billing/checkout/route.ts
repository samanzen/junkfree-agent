import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { createCheckoutSessionUrl, isStripeConfigured, type StripePlanKey } from "@/lib/billing/stripe";

export const maxDuration = 30;

// Self-serve Checkout — only works when Stripe env vars are set.
// Without keys, returns 503 with a clear message (no fake billing).

export async function GET() {
  return NextResponse.json({
    configured: isStripeConfigured(),
    plans: isStripeConfigured() ? ["founding", "growth"] : [],
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Self-serve billing is not configured yet. Contact your account manager." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string;
    plan?: string;
  };
  const brandId = body.brand_id || auth.brandId;
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const plan = (body.plan || "founding") as StripePlanKey;
  if (plan !== "founding" && plan !== "growth") {
    return NextResponse.json({ error: "Choose founding or growth." }, { status: 400 });
  }

  const result = await createCheckoutSessionUrl({
    plan,
    brandId,
    customerEmail: auth.email || null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: result.url });
}
