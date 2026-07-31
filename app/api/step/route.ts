import { NextRequest, NextResponse } from "next/server";
import { getBrandById } from "@/lib/brands";
import { processOneJob } from "@/lib/runner";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 60;

// Process ONE queued job for ONE brand (small enough to finish under 60s).
// The dashboard calls this repeatedly until { done: true }. Scoped to a
// single brand so a customer's browser can never drain another tenant's
// queue, and an admin only ever drains the brand currently selected in the
// dashboard.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brand_id } = await req.json().catch(() => ({}));
  if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  const brand = await getBrandById(brand_id);
  if (!brand || !brand.active) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const result = await processOneJob(brand.id);
  return NextResponse.json(result);
}
