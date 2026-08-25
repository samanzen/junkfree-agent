import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createInstallationToken,
  listInstallationRepos,
  analyzeRepository,
  saveGitHubAppConnection,
} from "@/lib/github-app";

export const maxDuration = 60;

/** Confirm selected repository → save GitHub App connection. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string;
    repo_id?: number;
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

  const token = await createInstallationToken(Number(pending.installation_id));
  if (!token.ok) return NextResponse.json({ error: token.error }, { status: 422 });

  const listed = await listInstallationRepos(token.token);
  if (!listed.ok) return NextResponse.json({ error: listed.error }, { status: 422 });

  const repo = listed.repos.find((r) => r.id === repoId);
  if (!repo) {
    return NextResponse.json(
      { error: "That repository is not in this GitHub App installation." },
      { status: 422 }
    );
  }

  const analysis = await analyzeRepository(token.token, repo, pending.site_url || null);
  const saved = await saveGitHubAppConnection({
    brandId,
    installationId: Number(pending.installation_id),
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
