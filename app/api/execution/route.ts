import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getBrandById } from "@/lib/brands";
import { enqueue } from "@/lib/queue";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { resolvePublishTarget, executionLogReachable } from "@/lib/execution/engine";
import { describeAdapters } from "@/lib/execution/registry";
import { toSiteChange, type DraftLike } from "@/lib/execution/changes";
import { supports } from "@/lib/execution/types";

export const maxDuration = 60;

// SITE EXECUTION API — the entry point that turns an approved draft into a
// queued site change.
//
// Deliberately NOT a second recommendation endpoint and NOT a second job
// runner. /api/intelligence/action already routes recommendations to content
// jobs, and lib/queue + lib/runner already execute jobs. This route covers the
// one step that did not exist: dispatching finished, approved work to the
// customer's actual website.
//
// Existing publish behaviour is untouched. /api/drafts/[id]/approve and
// /publish still write the `content` table exactly as before; this is an
// additive path, so a brand with no adapter connected behaves identically to
// how it did before this route existed.

// GET — what can this brand publish to, and is the plumbing actually working?
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const [target, log] = await Promise.all([resolvePublishTarget(brandId), executionLogReachable()]);

  // Live credential check, but only when something is actually connected --
  // it makes a real network call to the customer's site.
  let connection: { ok: boolean; detail: string } | null = null;
  if (target.ok) {
    const brand = await getBrandById(brandId);
    connection = brand
      ? await target.adapter
          .check({ brand, credentials: target.credentials, config: target.config })
          .catch((e) => ({ ok: false, detail: `Adapter check threw: ${e instanceof Error ? e.message : String(e)}` }))
      : { ok: false, detail: "Brand not found." };
  }

  return NextResponse.json({
    configured: target.ok,
    platform: target.ok ? target.platform : null,
    capabilities: target.ok ? [...target.adapter.capabilities] : [],
    reason: target.ok ? null : target.reason,
    reason_code: target.ok ? null : target.code,
    connection,
    // Surfaced on purpose: an unapplied migration is the single most expensive
    // failure mode this codebase has had, and it should be visible from the
    // product rather than only discoverable by querying Postgres by hand.
    execution_log: { available: log.ok, reason: log.reason },
    available_platforms: describeAdapters(),
  });
}

// POST — queue a publish for one approved draft.
// Body: { brand_id, draft_id, metaChoice? }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brand_id, draft_id, metaChoice } = await req.json().catch(() => ({}));
  if (!brand_id || !draft_id) {
    return NextResponse.json({ error: "brand_id and draft_id required" }, { status: 400 });
  }
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  const brand = await getBrandById(brand_id);
  if (!brand || !brand.active) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const { data: draft } = await db
    .from("drafts")
    .select("id, brand_id, task_type, title, body, target_url, target_keyword, status")
    .eq("id", draft_id)
    .single();
  if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });
  if (draft.brand_id !== brand_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (draft.status === "dismissed") {
    return NextResponse.json({ error: "This draft was dismissed and cannot be published." }, { status: 409 });
  }

  // Validate here rather than letting the job discover it later: an
  // improve_content audit report or an unchosen fix_meta can never succeed, and
  // saying so immediately beats a failed job the customer has to go find.
  const translation = toSiteChange(draft as DraftLike, brand.name, typeof metaChoice === "number" ? metaChoice : undefined);
  if (!translation.publishable) {
    return NextResponse.json({ error: "not_publishable", message: translation.reason }, { status: 422 });
  }

  const target = await resolvePublishTarget(brand_id);
  if (!target.ok) {
    return NextResponse.json({ error: target.code, message: target.reason }, { status: 409 });
  }
  if (!supports(target.adapter, translation.change)) {
    return NextResponse.json({
      error: "unsupported_change",
      message: `${target.adapter.label} cannot perform "${translation.change.type}". It supports: ${target.adapter.capabilities.join(", ")}.`,
    }, { status: 422 });
  }

  await enqueue(brand_id, "publish", {
    draftId: draft_id,
    ...(typeof metaChoice === "number" ? { metaChoice } : {}),
  });

  return NextResponse.json({
    ok: true,
    queued: true,
    platform: target.platform,
    change_type: translation.change.type,
    target: translation.change.type === "upsert_page" ? translation.change.slug : translation.change.url,
  });
}
