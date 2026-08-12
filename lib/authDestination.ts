// Client-safe post-auth landing helper.
// Admin → /dashboard. New customer (no brand) → /onboarding. Else → /portal
// (or a safe ?next= path under /portal|/onboarding).

export function safeAuthNext(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const path = raw.trim();
  if (!path.startsWith("/")) return undefined;
  if (path.startsWith("//") || path.includes("\\") || path.includes("..")) {
    return undefined;
  }
  // Path segment only — query may legally contain https:// for ?site=
  const pathOnly = path.split("?")[0] || "";
  if (pathOnly.includes("://")) return undefined;
  if (pathOnly === "/onboarding" || pathOnly.startsWith("/onboarding/")) return path;
  if (pathOnly === "/portal" || pathOnly.startsWith("/portal/")) return path;
  return undefined;
}

export function withSiteParam(path: string, site: string | null | undefined): string {
  if (!site) return path;
  try {
    const u = new URL(path, "https://local.invalid");
    if (!u.searchParams.get("site")) u.searchParams.set("site", site);
    return `${u.pathname}${u.search}`;
  } catch {
    return path;
  }
}

/**
 * Where to send someone after password or OAuth sign-in.
 * Prefer an explicit safe `next` for customers; never send customers to /dashboard.
 */
export async function destinationForSession(
  token?: string | null,
  opts?: { next?: string | null; site?: string | null }
): Promise<string> {
  const next = safeAuthNext(opts?.next);
  const site = opts?.site || null;
  try {
    const res = await fetch("/api/me", token ? { headers: { authorization: `Bearer ${token}` } } : {});
    if (!res.ok) {
      return withSiteParam(next || "/onboarding", site);
    }
    const me = await res.json();
    if (me.role === "admin") return "/dashboard";
    if (!me.brand_id) {
      return withSiteParam(next && next.startsWith("/onboarding") ? next : "/onboarding", site);
    }
    if (next && next.startsWith("/portal")) return next;
    return "/portal";
  } catch {
    return withSiteParam(next || "/onboarding", site);
  }
}

export type SocialProvider = "google" | "github" | "apple";

export function oauthRedirectTo(origin: string, opts?: { next?: string; site?: string | null }): string {
  const u = new URL("/auth/callback", origin);
  if (opts?.next) u.searchParams.set("next", opts.next);
  if (opts?.site) u.searchParams.set("site", opts.site);
  return u.toString();
}
