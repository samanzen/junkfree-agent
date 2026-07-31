import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 20;

// DELETE: remove a keyword from tracking (soft delete via status = lost).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const { data: kw } = await db.from("tracked_keywords").select("brand_id").eq("id", id).single();
  if (!kw) return NextResponse.json({ error: "not found" }, { status: 404 });
  const accessErr = requireBrandAccess(auth, kw.brand_id);
  if (accessErr) return accessErr;

  const { error } = await db
    .from("tracked_keywords")
    .update({ status: "lost", last_seen_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
