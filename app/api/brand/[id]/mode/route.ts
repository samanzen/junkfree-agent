import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getBrandById } from "@/lib/brands";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import {
  mergeAutopilotUpdate,
  readAutopilotMap,
  type RecommendationSection,
} from "@/lib/recommendations/sections";

export const maxDuration = 30;

const SECTIONS = new Set<RecommendationSection>([
  "issues",
  "opportunities",
  "content",
  "pages",
  "meta",
  "google_posts",
  "backlinks",
]);

/**
 * Set "Do automatically" for one AI Recommendations tab.
 * Body: { section, enabled: boolean }
 * Legacy: { auto_publish_meta: boolean } still toggles Meta.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const accessErr = requireBrandAccess(auth, id);
  if (accessErr) return accessErr;

  const body = await req.json().catch(() => ({}));
  const brand = await getBrandById(id);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  if (typeof body.auto_publish_meta === "boolean" && body.section == null) {
    const next = mergeAutopilotUpdate(readAutopilotMap(brand), "meta", body.auto_publish_meta);
    await db
      .from("brands")
      .update({ auto_publish_meta: body.auto_publish_meta, recommendation_autopilot: next })
      .eq("id", id);
    return NextResponse.json({ ok: true, recommendation_autopilot: next });
  }

  const section = body.section as RecommendationSection;
  if (!SECTIONS.has(section)) {
    return NextResponse.json(
      {
        error:
          "section must be one of: issues, opportunities, content, pages, meta, google_posts, backlinks",
      },
      { status: 400 }
    );
  }
  const enabled = !!body.enabled;
  const next = mergeAutopilotUpdate(readAutopilotMap(brand), section, enabled);
  const patch: Record<string, unknown> = { recommendation_autopilot: next };
  if (section === "meta") patch.auto_publish_meta = enabled;

  await db.from("brands").update(patch).eq("id", id);
  return NextResponse.json({ ok: true, recommendation_autopilot: next });
}
