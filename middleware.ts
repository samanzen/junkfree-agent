import { NextRequest, NextResponse } from "next/server";

// Minimal middleware — only blocks truly sensitive API routes.
// Auth verification happens inside each route handler, not here.
// This avoids timing out the Supabase browser auth flow.

const PROTECTED_API = new Set([
  "/api/run",
  "/api/step", 
  "/api/platform",
  "/api/analytics",
  "/api/portal",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let all non-API routes through (login, dashboard, portal, static files).
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Public API routes — no auth needed.
  if (
    pathname === "/api/me" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/drafts/") ||
    pathname.startsWith("/api/brand/") ||
    pathname.startsWith("/api/images/") ||
    pathname.startsWith("/api/portal/")
  ) {
    return NextResponse.next();
  }

  // For protected routes, just check a token exists — full verification
  // happens inside the route handler via /api/me.
  // This keeps middleware fast and avoids hanging on Supabase calls.
  const auth = req.headers.get("authorization");
  const cookieHeader = req.headers.get("cookie") || "";
  const hasSession = !!auth || cookieHeader.includes("sb-") || cookieHeader.includes("supabase");

  if (!hasSession && PROTECTED_API.has(pathname)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
