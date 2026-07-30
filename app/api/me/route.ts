import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";

// Given a Supabase access token, return the caller's profile (role + brand).
// admin => sees all brands; customer => locked to brand_id.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  return NextResponse.json({ id: auth.id, email: auth.email, role: auth.role, brand_id: auth.brandId });
}