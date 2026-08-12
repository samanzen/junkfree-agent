import { NextRequest, NextResponse } from "next/server";
import { recentAgentActivity } from "@/lib/agentActivity";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

// AGENT ACTIVITY API — what the platform has actually been doing for this brand.
//
// Read-only. Adds no job, changes no status, writes nothing. The queue and the
// runner are untouched; this only reads back rows they already produce.
//
// Same auth shape as every other /api/portal route: authenticate, then check
// this caller may see THIS brand, so one tenant can never read another's run
// history. No rate limit bucket is claimed because the query is a single
// indexed SELECT against jobs (jobs_brand_idx) with a hard row cap.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });

  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  // Bounded by the caller but hard-capped here, so a crafted request cannot
  // turn this into an unbounded scan.
  const requested = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 20) : 8;

  const activity = await recentAgentActivity(brandId, limit);
  return NextResponse.json(activity);
}
