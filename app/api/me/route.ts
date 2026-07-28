import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Given a Supabase access token, return the caller's profile (role + brand).
// admin => sees all brands; customer => locked to brand_id.
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "no token" }, { status: 401 });

  // Verify the token with Supabase Auth (via the service client's admin API).
  const { createClient } = await import("@supabase/supabase-js");
  const auth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: userData, error } = await auth.auth.getUser(token);
  if (error || !userData?.user) return NextResponse.json({ error: "invalid token" }, { status: 401 });

  const uid = userData.user.id;
  const email = userData.user.email;

  // Look up (or lazily create) the profile.
  let { data: profile } = await db.from("profiles").select("*").eq("id", uid).single();
  if (!profile) {
    await db.from("profiles").insert({ id: uid, email, role: "customer" });
    profile = { id: uid, email, role: "customer", brand_id: null };
  }
  return NextResponse.json({ id: uid, email, role: profile.role, brand_id: profile.brand_id });
}
