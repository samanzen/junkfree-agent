"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _c: SupabaseClient | null = null;

// Browser auth client. Uses the PUBLIC anon key (safe to expose). Handles
// login/session for customers and admins.
export function supabaseBrowser(): SupabaseClient {
  if (_c) return _c;
  _c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true } }
  );
  return _c;
}
