"use client";
import { supabaseBrowser } from "./supabaseBrowser";

// Same-origin fetch wrapper for calls to our own /api/* routes. Attaches the
// caller's Supabase session token so API routes can authorize the request via
// lib/auth.ts's requireAuth(). Use this instead of the bare fetch() for any
// browser call to an internal API route that requires a signed-in session.
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
