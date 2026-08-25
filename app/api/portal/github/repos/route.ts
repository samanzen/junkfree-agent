import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createInstallationToken,
  listInstallationRepos,
  analyzeRepository,
  rankReposForSite,
  githubAppConfigureUrl,
  pickReposToAnalyze,
  isRateLimitMessage,
} from "@/lib/github-app";

export const maxDuration = 60;

/** List + analyze repos for a pending GitHub App installation. */
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

  const token = await createInstallationToken(Number(pending.installation_id));
  if (!token.ok) {
    const friendly = isRateLimitMessage(token.error)
      ? "GitHub is briefly rate-limiting us. Wait a minute, then try again."
      : token.error;
    return NextResponse.json({ error: friendly }, { status: 422 });
  }

  const listed = await listInstallationRepos(token.token);
  if (!listed.ok) {
    const friendly = isRateLimitMessage(listed.error)
      ? "GitHub is briefly rate-limiting us. Wait a minute, then try again."
      : listed.error;
    return NextResponse.json({ error: friendly }, { status: 422 });
  }

  if (!listed.repos.length) {
    return NextResponse.json({
      installationId: pending.installation_id,
      accountLogin: pending.account_login,
      accountType: pending.account_type,
      repos: [],
      suggestedRepoId: null,
      ambiguous: false,
      addRepoUrl: githubAppConfigureUrl(pending.installation_id),
      message: "No repositories were authorized. Add repository access on GitHub, then return here.",
    });
  }

  const siteUrl = pending.site_url || null;
  // Metadata pre-sort, then deep-analyze only top candidates (avoids rate limits).
  const toAnalyze = pickReposToAnalyze(listed.repos, siteUrl, 8);
  const analyses = [];
  let hitRateLimit = false;
  for (const repo of toAnalyze) {
    try {
      const analysis = await analyzeRepository(token.token, repo, siteUrl);
      analyses.push(analysis);
      if (analysis.evidence.some((e) => /rate limit/i.test(e))) {
        hitRateLimit = true;
        break;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isRateLimitMessage(msg)) {
        hitRateLimit = true;
        break;
      }
    }
  }

  // If deep analysis couldn't run, still offer metadata-only cards so the customer can pick.
  if (!analyses.length) {
    for (const repo of toAnalyze.slice(0, 12)) {
      const [owner, name] = repo.fullName.split("/");
      analyses.push({
        repoId: repo.id,
        fullName: repo.fullName,
        owner: owner || repo.ownerLogin,
        name: name || repo.name,
        private: repo.private,
        defaultBranch: repo.defaultBranch,
        framework: null,
        packageManager: null,
        contentPath: null,
        hasBlogHints: false,
        hasSitemapHints: false,
        deploymentProvider: null,
        likelyDomain: repo.homepage || siteUrl,
        confidence: "low" as const,
        confidenceScore: 10,
        evidence: hitRateLimit ? ["Shown from GitHub access — detailed scan deferred"] : [],
        canCreateBranch: true,
        canOpenPullRequest: true,
        canUpdateContent: true,
      });
    }
  }

  const ranked = rankReposForSite(analyses);

  return NextResponse.json({
    installationId: pending.installation_id,
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
    addRepoUrl: githubAppConfigureUrl(pending.installation_id),
    rateLimited: hitRateLimit,
    message: hitRateLimit
      ? "GitHub briefly limited deep scanning. You can still pick your repository."
      : undefined,
  });
}
