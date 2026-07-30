// Shared authorization helper for API routes.
//
// This does NOT replace or duplicate Supabase Auth — it centralizes the three
// steps every route was either skipping or re-implementing inline:
//   1. Validate the caller's Supabase session token (via supabase-js's own
//      auth.getUser(), same call app/api/me used before this file existed).
//   2. Look up their `profiles` row (role + brand_id).
//   3. Check role / brand ownership against what the route is about to do.
//
// Supabase remains the single source of truth for authentication; this file
// only reads its result and enforces authorization on top of it.

import { NextRequest, NextResponse } from "next/server";
import { db } from "./supabase";

export type AuthContext = {
  id: string;
  email: string | null;
  role: string; // "admin" | "customer"
  brandId: string | null;
};

/**
 * Validates the Authorization: Bearer <token> header against Supabase Auth
 * and loads the caller's profile (role + brand). Returns a NextResponse
 * (401) on any failure — callers should check with isAuthError() and return
 * it directly.
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext | NextResponse> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: userData, error } = await db.auth.getUser(token);
  if (error || !userData?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const uid = userData.user.id;
  const email = userData.user.email ?? null;

  let { data: profile } = await db
    .from("profiles")
    .select("role, brand_id, email")
    .eq("id", uid)
    .single();

  if (!profile) {
    // First sign-in: lazily create the profile row (same behavior app/api/me
    // has always had — new users default to role "customer" with no brand
    // until an admin assigns one).
    await db.from("profiles").insert({ id: uid, email, role: "customer" });
    profile = { role: "customer", brand_id: null, email };
  }

  return { id: uid, email: profile.email ?? email, role: profile.role, brandId: profile.brand_id };
}

export function isAuthError(auth: AuthContext | NextResponse): auth is NextResponse {
  return auth instanceof NextResponse;
}

/** 403 unless the caller is an admin. */
export function requireAdmin(auth: AuthContext): NextResponse | null {
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

/** 403 unless the caller is an admin or owns the given brand. */
export function requireBrandAccess(auth: AuthContext, brandId: string | null | undefined): NextResponse | null {
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  if (auth.role === "admin") return null;
  if (auth.brandId === brandId) return null;
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}