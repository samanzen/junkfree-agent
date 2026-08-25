import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createInstallationToken,
  getInstallationRepo,
  analyzeRepository,
  analysisFromMetadata,
  saveGitHubAppConnection,
  isRateLimitMessage,
  type InstallationRepo,
} from "@/lib/github-app";

export const maxDuration = 60;

type CachedRepo = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  homepage: string | null;
  description: string | null;
  ownerLogin: string;
};

function asInstallationRepo(raw: CachedRepo): InstallationRepo {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.fullName,
    private: !!raw.private,
    defaultBranch: raw.defaultBranch || "main",
    htmlUrl: raw.htmlUrl || "",
    homepage: raw.homepage || null,
    description: raw.description || null,
    ownerLogin: raw.ownerLogin || raw.fullName.split("/")[0] || "",
  };
}

/** Confirm selected repository → save GitHub App connection. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string;
    repo_id?: number;
    owner?: string;
    name?: string;
  };
  const brandId = body.brand_id;
  const repoId = Number(body.repo_id);
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  if (!repoId) return NextResponse.json({ error: "repo_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const { data: pending } = await db
    .from("github_app_pending_installs")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (!pending) {
    return NextResponse.json({ error: "No pending GitHub authorization." }, { status: 404 });
  }

  const installationId = Number(pending.installation_id);
  const token = await createInstallationToken(installationId);
  if (!token.ok) {
    return NextResponse.json(
      {
        error: isRateLimitMessage(token.error)
          ? "GitHub needs a short break. Wait about 10 minutes, then confirm once."
          : token.error,
      },
      { status: isRateLimitMessage(token.error) ? 429 : 422 }
    );
  }

  let repo: InstallationRepo | null = null;

  // Prefer a single-repo fetch when the client sends owner/name (avoids re-listing).
  const owner = (body.owner || "").trim();
  const name = (body.name || "").trim();
  if (owner && name) {
    const got = await getInstallationRepo(token.token, owner, name);
    if (got.ok && got.repo.id === repoId) {
      repo = got.repo;
    }
  }

  // Fallback: cached list from the discovery step.
  if (!repo && Array.isArray(pending.repos_cache)) {
    const hit = (pending.repos_cache as CachedRepo[]).find((r) => Number(r.id) === repoId);
    if (hit) repo = asInstallationRepo(hit);
  }

  if (!repo) {
    return NextResponse.json(
      {
        error:
          "We couldn't verify that repository just now. Wait a few minutes and pick it again from the list.",
      },
      { status: 422 }
    );
  }

  // Deep-scan only the chosen repo. If GitHub is still rate-limiting, save metadata-only.
  let analysis = analysisFromMetadata(repo, pending.site_url || null);
  try {
    analysis = await analyzeRepository(token.token, repo, pending.site_url || null);
  } catch {
    /* keep metadata analysis */
  }

  const saved = await saveGitHubAppConnection({
    brandId,
    installationId,
    accountLogin: pending.account_login,
    accountType: pending.account_type,
    accountId: Number(pending.account_id || 0),
    analysis,
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  await db.from("github_app_pending_installs").delete().eq("brand_id", brandId);

  return NextResponse.json({
    ok: true,
    message: "GitHub connected. Changes will ship as pull requests.",
    connection: {
      repository: analysis.fullName,
      framework: analysis.framework,
      defaultBranch: analysis.defaultBranch,
      contentPath: analysis.contentPath,
      publishingMethod: "Pull requests",
    },
  });
}
