import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getBrandById } from "@/lib/brands";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { resolvePublishTarget } from "@/lib/execution/engine";
import { buildSetupProgress } from "@/lib/setup";
import { enqueue, pendingCount } from "@/lib/queue";
import { enforceRate } from "@/lib/rateLimit";

export const maxDuration = 60;

// Activation journey status — derived from live brand state (no new columns).

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const [kwCountRes, posCountRes, draftRes, publishTarget, pendingSync] =
    await Promise.all([
      db
        .from("tracked_keywords")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brandId),
      db
        .from("keyword_positions")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brandId),
      db
        .from("drafts")
        .select("id, status")
        .eq("brand_id", brandId)
        .in("status", ["pending_review", "approved", "published"])
        .limit(20),
      resolvePublishTarget(brandId),
      pendingCount(brandId, ["rank_sync"]),
    ]);

  // Best-effort: migration 011 may not be applied in every environment.
  const { data: execRows } = await db
    .from("publish_executions")
    .select("id")
    .eq("brand_id", brandId)
    .eq("status", "succeeded")
    .limit(1);

  const hasIntelligence =
    (kwCountRes.count || 0) > 0 || (posCountRes.count || 0) > 0;

  const drafts = (draftRes.data || []) as { id: string; status: string }[];
  const pendingDrafts = drafts.filter((d) => d.status === "pending_review").length;
  const hasFirstApproval =
    drafts.some((d) => d.status === "approved" || d.status === "published") ||
    !!(execRows && execRows.length);

  const progress = buildSetupProgress({
    hasBrand: true,
    hasSiteUrl: !!brand.site_url,
    hasGsc: !!brand.gsc_property,
    hasIntelligence,
    hasPublishing: publishTarget.ok,
    hasFirstApproval,
  });

  return NextResponse.json({
    progress,
    brand: {
      id: brand.id,
      name: brand.name,
      site_url: brand.site_url,
      gsc_property: brand.gsc_property,
    },
    signals: {
      pending_drafts: pendingDrafts,
      intelligence_ready: hasIntelligence,
      publishing_connected: publishTarget.ok,
      publishing_reason: publishTarget.ok ? null : publishTarget.reason,
      sync_pending: pendingSync > 0,
      keyword_count: kwCountRes.count || 0,
    },
  });
}

// POST — start first intelligence sync (rank_sync) when GSC is connected.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string;
    action?: string;
  };
  const brandId = body.brand_id;
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  if (body.action !== "start_intelligence") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });
  if (!brand.gsc_property) {
    return NextResponse.json(
      { error: "Connect Google Search Console before pulling intelligence." },
      { status: 400 },
    );
  }

  const limited = await enforceRate(brandId, "dispatch");
  if (limited) return limited;

  const pending = await pendingCount(brandId, ["rank_sync"]);
  if (pending > 0) {
    return NextResponse.json({
      ok: true,
      queued: false,
      message: "A sync is already in progress — we'll use that one.",
    });
  }

  await enqueue(brandId, "rank_sync", {});
  return NextResponse.json({
    ok: true,
    queued: true,
    message: "First intelligence sync started. Keywords usually land within a few minutes.",
  });
}
