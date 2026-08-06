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
  // MEASURED: this matched all 36 API routes, but the handler above only acts
  // on two of them — every other API request paid a middleware invocation to
  // reach `return NextResponse.next()`. On Vercel that is an edge function
  // execution per request, for nothing.
  //
  // Matching only the two guarded paths is behaviourally identical: the same
  // requests are checked by the same logic, and the 34 routes that always fell
  // through now skip the invocation entirely rather than being waved past.
  matcher: ["/api/run", "/api/step"],
};
