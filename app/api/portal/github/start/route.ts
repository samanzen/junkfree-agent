import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import {
  githubAppConfigured,
  githubAppInstallUrl,
  signGitHubAppState,
  createAuthAttempt,
} from "@/lib/github-app";

/**
 * Step 1: return the official GitHub App installation URL.
 * Client navigates after fetch (bearer token in localStorage).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  const siteUrl = url.searchParams.get("site_url");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  if (!githubAppConfigured()) {
    console.error("[github/start] GitHub App env is not configured.");
    return NextResponse.json(
      {
        error: "Connecting with GitHub isn't available right now. Please try again shortly.",
        configured: false,
      },
      { status: 503 }
    );
  }

  const nonce = randomBytes(16).toString("base64url");
  const origin = url.origin;
  const state = signGitHubAppState({
    brandId,
    userId: auth.id,
    origin,
    siteUrl: siteUrl || null,
    nonce,
  });

  const created = await createAuthAttempt({
    nonce,
    brandId,
    userId: auth.id,
    origin,
    siteUrl: siteUrl || null,
  });
  if (!created.ok) {
    console.error("[github/start] auth attempt failed", created.error);
    return NextResponse.json({ error: created.error, configured: true }, { status: 503 });
  }

  return NextResponse.json({
    url: githubAppInstallUrl(state),
    configured: true,
  });
}
