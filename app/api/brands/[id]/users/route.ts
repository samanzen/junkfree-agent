import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireAdmin } from "@/lib/auth";

export const maxDuration = 30;

const ROLES = ["admin", "customer"];

// Link an existing profile (by email) to a brand (Sprint 6.3 Phase 2).
// "Existing" is load-bearing: this never creates a profile -- that only ever
// happens via lib/auth.ts's requireAuth() lazy-insert on a user's first
// sign-in. If no profile exists yet for the given email, the admin needs to
// have that person sign in once first; this route reports that instead of
// trying to create one out-of-band.
// Body: { email, role }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const { id: brandId } = await params;
  const { email, role } = await req.json().catch(() => ({}));

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${ROLES.join(", ")}` }, { status: 400 });
  }

  const { data: brand } = await db.from("brands").select("id").eq("id", brandId).single();
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const { data: profile } = await db.from("profiles").select("id").eq("email", email).single();
  if (!profile) {
    return NextResponse.json(
      { error: "no profile found for that email — ask them to sign in once first" },
      { status: 404 }
    );
  }

  const { data, error } = await db
    .from("profiles")
    .update({ brand_id: brandId, role })
    .eq("id", profile.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profile: data });
}
