import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";
import { detectWebsite } from "@/lib/website-connection/detect";

export const maxDuration = 30;

/** POST { brand_id, url } → detect platform + recommend connector. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as { brand_id?: string; url?: string };
  const brandId = body.brand_id;
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const limited = await enforceRate(brandId, "dispatch");
  if (limited) return limited;

  const result = await detectWebsite(body.url || "");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
