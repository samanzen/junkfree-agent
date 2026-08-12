import { NextRequest, NextResponse } from "next/server";
import { getBrandById } from "@/lib/brands";
import { processOneJob } from "@/lib/runner";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";

export const maxDuration = 60;

// Process ONE queued job for ONE brand (small enough to finish under 60s).
// The dashboard calls this repeatedly until { done: true }. Scoped to a
// single brand so a customer's browser can never drain another tenant's
// queue, and an admin only ever drains the brand currently selected in the
// dashboard.
//
// Rate-limited as "dispatch": this is the route that actually spends
// Claude / DataForSEO / Gemini on queued work. Phase 1.6 metered the
// enqueue/AI routes but left this one open, so a looped browser could still
// drain budget after jobs were seeded.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brand_id } = await req.json().catch(() => ({}));
  if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  const limited = await enforceRate(brand_id, "dispatch");
  if (limited) return limited;

  const brand = await getBrandById(brand_id);
  if (!brand || !brand.active) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const result = await processOneJob(brand.id);
  return NextResponse.json(result);
}
