import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Routes that do NOT require authentication.
const PUBLIC_ROUTES = new Set([
  "/api/me",                    // the auth verifier itself
  "/api/cron/orchestrate",      // protected separately by CRON_SECRET
  "/login",
  "/",                          // root redirects to dashboard (redirect only)
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only intercept API routes and the dashboard/portal. Static assets, fonts,
  // Next internals (_next/*) are excluded by the matcher below.
  if (!pathname.startsWith("/api/") && pathname !== "/dashboard" && pathname !== "/portal") {
    return NextResponse.next();
  }

  // Public routes bypass auth.
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // Cron calls arrive with an Authorization: Bearer <CRON_SECRET> header.
  // They have no user session — let the route handler validate the secret itself.
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && process.env.CRON_SECRET) {
    if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.next();
    }
  }

  // All other API calls must carry a valid Supabase session cookie.
  // We read the `sb-<project>-auth-token` cookie that the browser client sets.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // In development without env vars, let requests through so the dev
    // experience is not blocked.
    return NextResponse.next();
  }

  // Extract the access token from the Authorization header (used by
  // dashboard fetch calls which pass `Authorization: Bearer <token>`).
  let token: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // Fall back to reading the Supabase cookie directly.
  if (!token) {
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (projectRef) {
      const cookieName = `sb-${projectRef}-auth-token`;
      const raw = req.cookies.get(cookieName)?.value;
      if (raw) {
        try {
          const parsed = JSON.parse(decodeURIComponent(raw));
          token = parsed?.access_token ?? null;
        } catch {
          // cookie parse failed — token stays null
        }
      }
    }
  }

  if (!token) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
  }

  // Verify the token with Supabase.
  try {
    const auth = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { error } = await auth.auth.getUser(token);
    if (error) throw error;
  } catch {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes, the admin dashboard, and the customer portal.
    // Exclude Next.js internals and static files.
    "/api/:path*",
    "/dashboard",
    "/portal",
  ],
};
