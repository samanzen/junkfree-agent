import { NextRequest, NextResponse } from "next/server";

// Minimal middleware. Auth verification happens inside route handlers.
// Only blocks routes that trigger expensive agent work.
const PROTECTED = new Set(["/api/run", "/api/step"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!PROTECTED.has(pathname)) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  const cookie = req.headers.get("cookie") || "";
  const hasSession = !!auth || cookie.includes("sb-") || cookie.includes("supabase");

  if (!hasSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
