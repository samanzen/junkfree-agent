import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import {
  getGitHubAppConnection,
  createInstallationToken,
  getInstallation,
  listInstallationRepos,
  githubAppConfigureUrl,
  analyzeRepository,
} from "@/lib/github-app";
import { getAdapter } from "@/lib/execution/registry";
import { getBrandById } from "@/lib/brands";
import { getDecryptedCredentials, getIntegration } from "@/lib/integrations";

export const maxDuration = 60;

/** Connection status + manage-access URL for a connected GitHub App. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const conn = await getGitHubAppConnection(brandId);
  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    repository: conn.fullName,
    owner: conn.owner,
    repo: conn.repo,
    framework: conn.framework,
    defaultBranch: conn.baseBranch,
    contentPath: conn.contentPath,
    private: conn.private,
    publishingMethod: "Pull requests",
    permissions: {
      metadata: "read",
      contents: "read_write",
      pull_requests: "read_write",
    },
    manageAccessUrl: githubAppConfigureUrl(conn.installationId),
    evidence: conn.analysisEvidence,
  });
}

/** Recheck installation + repository access; refresh analysis metadata when possible. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as { brand_id?: string };
  const brandId = body.brand_id;
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const conn = await getGitHubAppConnection(brandId);
  if (!conn) {
    return NextResponse.json({ error: "GitHub is not connected for this brand." }, { status: 404 });
  }

  const installation = await getInstallation(conn.installationId);
  if (!installation.ok) {
    return NextResponse.json(
      { ok: false, error: "Installation is no longer valid. Reconnect GitHub.", reason: "installation" },
      { status: 422 }
    );
  }
  if (installation.suspended) {
    return NextResponse.json(
      { ok: false, error: "GitHub App installation is suspended.", reason: "suspended" },
      { status: 422 }
    );
  }

  const token = await createInstallationToken(conn.installationId);
  if (!token.ok) {
    return NextResponse.json({ ok: false, error: token.error }, { status: 422 });
  }

  const listed = await listInstallationRepos(token.token);
  if (!listed.ok) {
    return NextResponse.json({ ok: false, error: listed.error }, { status: 422 });
  }

  const repo = listed.repos.find((r) => r.id === conn.repoId);
  if (!repo) {
    return NextResponse.json(
      {
        ok: false,
        error: "The connected repository is no longer authorized. Add repository access on GitHub.",
        reason: "repo_access",
        manageAccessUrl: githubAppConfigureUrl(conn.installationId),
      },
      { status: 422 }
    );
  }

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const integration = await getIntegration(brandId, "github");
  const credentials = (await getDecryptedCredentials(brandId, "github")) || {};
  const adapter = getAdapter("github");
  const check = await adapter.check({
    brand,
    credentials,
    config: (integration?.metadata || {}) as Record<string, unknown>,
  });
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.detail }, { status: 422 });
  }

  const analysis = await analyzeRepository(token.token, repo, brand.site_url || null);

  return NextResponse.json({
    ok: true,
    message: check.detail,
    connection: {
      repository: analysis.fullName,
      framework: analysis.framework,
      defaultBranch: analysis.defaultBranch,
      contentPath: analysis.contentPath,
      publishingMethod: "Pull requests",
    },
  });
}
