import { NextRequest, NextResponse } from "next/server";
import { getBrandById } from "@/lib/brands";
import { clearStale } from "@/lib/queue";
import { triggerBrandRun } from "@/lib/runner";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 60;

// Kick off a run for ONE brand — never all tenants. Customers may only
// trigger a brand they own; admins may trigger any brand. Seeds that brand's
// job queue (plan + rank_sync when GSC is configured) unless a seed is
// already in flight or a backlog is still pending for it, in which case this
// just reports what's already queued instead of duplicating it.
//
// rank_sync is what populates tracked_keywords / keyword_positions /
// position_distribution_snapshots — i.e. every Intelligence panel (Keywords,
// Winners & Losers, Distribution, Overview).
//
// Processing happens via repeated /api/step calls (driven by the dashboard)
// or, unattended, via the cron path in app/api/cron/orchestrate.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brand_id } = await req.json().catch(() => ({}));
  if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  const brand = await getBrandById(brand_id);
  if (!brand || !brand.active) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  await clearStale(brand.id);
  const result = await triggerBrandRun(brand);

  if (result.status === "locked") {
    return NextResponse.json(
      { error: "locked", message: "This brand already has a run starting elsewhere. Try again shortly." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, brand: brand.slug, queued: result.queued });
}
