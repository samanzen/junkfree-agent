import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createInstallationToken,
  listInstallationRepos,
  analyzeRepository,
  rankReposForSite,
  githubAppConfigureUrl,
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
    return NextResponse.json({ error: token.error }, { status: 422 });
  }

  const listed = await listInstallationRepos(token.token);
  if (!listed.ok) {
    return NextResponse.json({ error: listed.error }, { status: 422 });
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

  const analyses = [];
  for (const repo of listed.repos.slice(0, 40)) {
    analyses.push(await analyzeRepository(token.token, repo, pending.site_url || null));
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
    // Multiple repos always need a visual choice; high-confidence is only preselected.
    needsSelection: analyses.length !== 1,
    ambiguous: ranked.ambiguous,
    addRepoUrl: githubAppConfigureUrl(pending.installation_id),
  });
}
