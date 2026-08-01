import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireAdmin } from "@/lib/auth";

export const maxDuration = 30;

// Admin-only brand activation control (Sprint 6.8 Phase 2). Deliberately a
// separate route from app/api/brand/[id]/mode -- that route's auth model
// (requireBrandAccess, reachable by a brand's own customer) is wrong for
// activation, which brings a brand online to start consuming real, shared
// API budget and must stay admin-only. New brands are created inactive
// (app/api/brands/route.ts POST, Phase 1); this is the deliberate,
// separate action that flips them live.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const { id } = await params;
  const { active } = await req.json().catch(() => ({}));

  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  }

  const { data, error } = await db
    .from("brands")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // PGRST116 = PostgREST "no rows returned" for .single() -- id doesn't exist.
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "brand not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, brand: data });
}
