import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createInstallationToken,
  listInstallationRepos,
  analysisFromMetadata,
  rankReposForSite,
  githubAppConfigureUrl,
  isRateLimitMessage,
} from "@/lib/github-app";

export const maxDuration = 30;

/**
 * List authorized repos for a pending GitHub App installation.
 * Metadata-only — no per-repo content scans (those run on Confirm for one repo).
 * This keeps the return-from-GitHub step to ~2 API calls and avoids rate limits.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const { data: pending } = await db
    .from("github_app_pending_installs")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();

  if (!pending) {
    return NextResponse.json({ error: "No pending GitHub authorization for this brand." }, { status: 404 });
  }

  const installationId = Number(pending.installation_id);
  const addRepoUrl = githubAppConfigureUrl(installationId);

  const token = await createInstallationToken(installationId);
  if (!token.ok) {
    const rateLimited = isRateLimitMessage(token.error);
    return NextResponse.json(
      {
        error: rateLimited
          ? "GitHub needs a short break after too many requests. Wait about 10 minutes, then try once."
          : token.error,
        rateLimited,
        retryAfterSeconds: rateLimited ? 600 : undefined,
        addRepoUrl,
      },
      { status: rateLimited ? 429 : 422 }
    );
  }

  const listed = await listInstallationRepos(token.token);
  if (!listed.ok) {
    const rateLimited = isRateLimitMessage(listed.error);
    return NextResponse.json(
      {
        error: rateLimited
          ? "GitHub needs a short break after too many requests. Wait about 10 minutes, then try once."
          : listed.error,
        rateLimited,
        retryAfterSeconds: rateLimited ? 600 : undefined,
        addRepoUrl,
      },
      { status: rateLimited ? 429 : 422 }
    );
  }

  if (!listed.repos.length) {
    return NextResponse.json({
      installationId,
      accountLogin: pending.account_login,
      accountType: pending.account_type,
      repos: [],
      suggestedRepoId: null,
      ambiguous: false,
      addRepoUrl,
      message: "No repositories were authorized. Add repository access on GitHub, then return here.",
    });
  }

  const siteUrl = pending.site_url || null;
  const analyses = listed.repos
    .slice(0, 50)
    .map((repo) => analysisFromMetadata(repo, siteUrl))
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const ranked = rankReposForSite(analyses);

  // Cache minimal repo list on the pending row so Confirm can resolve without re-listing.
  // Ignore errors if migration 026 hasn't been applied yet.
  const { error: cacheErr } = await db
    .from("github_app_pending_installs")
    .update({
      repos_cache: listed.repos.slice(0, 50).map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.fullName,
        private: r.private,
        defaultBranch: r.defaultBranch,
        htmlUrl: r.htmlUrl,
        homepage: r.homepage,
        description: r.description,
        ownerLogin: r.ownerLogin,
      })),
    })
    .eq("brand_id", brandId);
  if (cacheErr) {
    console.error("[github/repos] repos_cache update skipped", cacheErr.message);
  }

  return NextResponse.json({
    installationId,
    accountLogin: pending.account_login,
    accountType: pending.account_type,
    siteUrl: pending.site_url,
    repos: analyses.map((a) => ({
      id: a.repoId,
      name: a.name,
      fullName: a.fullName,
      owner: a.owner,
      private: a.private,
      defaultBranch: a.defaultBranch,
      framework: a.framework,
      likelyDomain: a.likelyDomain,
      confidence: a.confidence,
      confidenceScore: a.confidenceScore,
      contentPath: a.contentPath,
      deploymentProvider: a.deploymentProvider,
      evidence: a.evidence,
    })),
    suggestedRepoId:
      ranked.best?.repoId ?? (analyses.length === 1 ? analyses[0].repoId : null),
    needsSelection: analyses.length !== 1,
    ambiguous: ranked.ambiguous,
    addRepoUrl,
  });
}
