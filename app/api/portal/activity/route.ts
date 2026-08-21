import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { listRecentActivity, listActiveFindings } from "@/lib/agents/store";

export const maxDuration = 30;

// Feature 01 observability: autonomous team activity + active findings.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") || 40), 100);
  const [activity, findings] = await Promise.all([
    listRecentActivity(brandId, limit),
    listActiveFindings(brandId, undefined, 20),
  ]);

  return NextResponse.json({ activity, findings });
}
