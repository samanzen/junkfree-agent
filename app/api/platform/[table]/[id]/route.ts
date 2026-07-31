import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

// Update the status of a gbp_posts / review_responses / citations row.
// Body: { status: "approved" | "dismissed" | "live" | "skipped" | ... }
const ALLOWED = new Set(["gbp_posts", "review_responses", "citations"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { table, id } = await params;
  if (!ALLOWED.has(table)) {
    return NextResponse.json({ error: "bad table" }, { status: 400 });
  }
  const { status } = await req.json().catch(() => ({ status: null }));
  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const { data: row } = await db.from(table).select("brand_id").eq("id", id).single();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  const accessErr = requireBrandAccess(auth, row.brand_id);
  if (accessErr) return accessErr;

  const { error } = await db.from(table).update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
