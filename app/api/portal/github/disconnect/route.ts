import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { disconnectGitHubApp, githubAppConfigureUrl, getGitHubAppConnection } from "@/lib/github-app";

/** Disconnect GitHub App connection for this brand (tenant-isolated). */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as { brand_id?: string };
  const brandId = body.brand_id;
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const before = await getGitHubAppConnection(brandId);
  await disconnectGitHubApp(brandId);

  return NextResponse.json({
    ok: true,
    message: "GitHub disconnected.",
    // Optional: customer can revoke app install on GitHub separately.
    manageAccessUrl: before ? githubAppConfigureUrl(before.installationId) : null,
  });
}
