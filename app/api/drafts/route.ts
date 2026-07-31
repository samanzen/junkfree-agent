import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireAdmin } from "@/lib/auth";

// Unscoped by brand — returns drafts across every tenant, so this is an
// admin-only view (customers use /api/platform?brand=<their id> instead).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const { data } = await db
    .from("drafts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json(data || []);
}
