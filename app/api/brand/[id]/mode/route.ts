import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { isExecutionMode, legacyFromMode } from "@/lib/agents/contracts";

export const maxDuration = 30;

// Feature 01: set automation mode (approval | hybrid | autopilot).
// Keeps auto_publish_meta in sync for legacy UI paths.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const accessErr = requireBrandAccess(auth, id);
  if (accessErr) return accessErr;

  const body = await req.json().catch(() => ({}));

  // Legacy clients still send { auto_publish_meta: boolean }.
  if ("execution_mode" in body || "autopilot_enabled" in body) {
    const patch: Record<string, unknown> = {};
    if (isExecutionMode(body.execution_mode)) {
      patch.execution_mode = body.execution_mode;
      patch.auto_publish_meta = legacyFromMode(body.execution_mode);
    }
    if (typeof body.autopilot_enabled === "boolean") {
      patch.autopilot_enabled = body.autopilot_enabled;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "invalid mode payload" }, { status: 400 });
    }
    await db.from("brands").update(patch).eq("id", id);
    return NextResponse.json({ ok: true, ...patch });
  }

  const auto = !!body.auto_publish_meta;
  await db
    .from("brands")
    .update({
      auto_publish_meta: auto,
      execution_mode: auto ? "hybrid" : "approval",
    })
    .eq("id", id);
  return NextResponse.json({ ok: true, auto_publish_meta: auto, execution_mode: auto ? "hybrid" : "approval" });
}
