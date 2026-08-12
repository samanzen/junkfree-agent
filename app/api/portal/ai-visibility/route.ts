import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { getBrandById } from "@/lib/brands";
import { listAiPrompts, listRecentAiChecks, upsertAiPrompt } from "@/lib/aiVisibility";
import { checkAiVisibilitySuite } from "@/lib/geo-agent";
import { persistAiVisibilityChecks } from "@/lib/aiVisibility";
import { canUse, quotaFor } from "@/lib/capabilities";
import { latestWithDelta } from "@/lib/metrics";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = req.nextUrl.searchParams.get("brand") || auth.brandId;
  if (!brandId) return NextResponse.json({ error: "No brand." }, { status: 400 });
  const denied = requireBrandAccess(auth, brandId);
  if (denied) return denied;

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "Brand not found." }, { status: 404 });

  const [prompts, checks, metrics] = await Promise.all([
    listAiPrompts(brandId),
    listRecentAiChecks(brandId, 50),
    latestWithDelta(brandId),
  ]);

  return NextResponse.json({
    score: metrics.current?.ai_visibility ?? null,
    scoreDelta:
      metrics.current?.ai_visibility != null && metrics.previous?.ai_visibility != null
        ? metrics.current.ai_visibility - metrics.previous.ai_visibility
        : null,
    prompts,
    checks,
    quota: quotaFor(brand, "ai_prompts"),
    enabled: canUse(brand, "ai_visibility_tracking"),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string;
    prompt?: string;
    action?: "add_prompt" | "run_check";
  };
  const brandId = body.brand_id || auth.brandId;
  if (!brandId) return NextResponse.json({ error: "No brand." }, { status: 400 });
  const denied = requireBrandAccess(auth, brandId);
  if (denied) return denied;

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  if (!canUse(brand, "ai_visibility_tracking")) {
    return NextResponse.json({ error: "AI visibility is not on this plan." }, { status: 403 });
  }

  if (body.action === "add_prompt") {
    const prompts = await listAiPrompts(brandId);
    if (prompts.length >= quotaFor(brand, "ai_prompts")) {
      return NextResponse.json(
        { error: `Your plan tracks up to ${quotaFor(brand, "ai_prompts")} prompts.` },
        { status: 400 }
      );
    }
    const result = await upsertAiPrompt(brandId, body.prompt || "");
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, prompts: await listAiPrompts(brandId) });
  }

  // Default: run a fresh suite now (expensive — used from portal "Check now").
  const promptCap = Math.min(5, quotaFor(brand, "ai_prompts"));
  const custom = (await listAiPrompts(brandId)).map((p) => p.prompt);
  const suite = await checkAiVisibilitySuite(
    brand,
    promptCap,
    custom.length ? custom : undefined
  );
  await persistAiVisibilityChecks(brandId, suite.checks).catch(() => undefined);
  return NextResponse.json({
    ok: true,
    score: suite.score,
    checks: suite.checks.map((c) => ({
      prompt: c.prompt,
      engine: c.engine,
      mentioned: c.mentioned,
      captured_at: new Date().toISOString(),
    })),
  });
}
