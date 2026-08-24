/**
 * Persist GitHub App connection on brand_integrations (provider=github).
 * Credentials bag stores authType only — installation tokens are minted on demand.
 */

import {
  upsertIntegrationCredentials,
  disconnectIntegration,
  getIntegration,
  findConnectedIntegration,
} from "../integrations";
import { persistBrandWriter, capabilityMapFor, clearBrandWriter } from "../execution/site-capabilities";
import { githubAdapter } from "../execution/adapters/github";
import { confirmSourceOfTruth, detectAndStoreSourceOfTruth } from "../execution/source-of-truth";
import { INTEGRATION_SITE_PLATFORMS } from "../execution/registry";
import type { RepoAnalysis } from "./analyze";
import { getBrandById } from "../brands";

export type GitHubAppConnectionMeta = {
  authType: "github_app";
  installationId: number;
  repoId: number;
  owner: string;
  repo: string;
  fullName: string;
  accountLogin: string;
  accountType: string;
  accountId: number;
  baseBranch: string;
  contentPath: string | null;
  framework: string | null;
  packageManager: string | null;
  deploymentProvider: string | null;
  private: boolean;
  analysisEvidence: string[];
  connectedAt: string;
};

export function parseGitHubAppMeta(metadata: Record<string, unknown> | null | undefined): GitHubAppConnectionMeta | null {
  if (!metadata || metadata.authType !== "github_app") return null;
  const installationId = Number(metadata.installationId);
  const repoId = Number(metadata.repoId);
  if (!installationId || !repoId) return null;
  return {
    authType: "github_app",
    installationId,
    repoId,
    owner: String(metadata.owner || ""),
    repo: String(metadata.repo || ""),
    fullName: String(metadata.fullName || `${metadata.owner}/${metadata.repo}`),
    accountLogin: String(metadata.accountLogin || ""),
    accountType: String(metadata.accountType || "User"),
    accountId: Number(metadata.accountId || 0),
    baseBranch: String(metadata.baseBranch || "main"),
    contentPath: metadata.contentPath ? String(metadata.contentPath) : null,
    framework: metadata.framework ? String(metadata.framework) : null,
    packageManager: metadata.packageManager ? String(metadata.packageManager) : null,
    deploymentProvider: metadata.deploymentProvider ? String(metadata.deploymentProvider) : null,
    private: !!metadata.private,
    analysisEvidence: Array.isArray(metadata.analysisEvidence)
      ? metadata.analysisEvidence.map(String)
      : [],
    connectedAt: String(metadata.connectedAt || ""),
  };
}

export async function saveGitHubAppConnection(opts: {
  brandId: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
  accountId: number;
  analysis: RepoAnalysis;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const brand = await getBrandById(opts.brandId);
  if (!brand) return { ok: false, error: "Brand not found." };

  const meta: GitHubAppConnectionMeta = {
    authType: "github_app",
    installationId: opts.installationId,
    repoId: opts.analysis.repoId,
    owner: opts.analysis.owner,
    repo: opts.analysis.name,
    fullName: opts.analysis.fullName,
    accountLogin: opts.accountLogin,
    accountType: opts.accountType,
    accountId: opts.accountId,
    baseBranch: opts.analysis.defaultBranch,
    contentPath: opts.analysis.contentPath,
    framework: opts.analysis.framework,
    packageManager: opts.analysis.packageManager,
    deploymentProvider: opts.analysis.deploymentProvider,
    private: opts.analysis.private,
    analysisEvidence: opts.analysis.evidence.slice(0, 12),
    connectedAt: new Date().toISOString(),
  };

  // No long-lived token stored — adapter mints installation tokens on demand.
  await upsertIntegrationCredentials(
    opts.brandId,
    "github",
    {
      authType: "github_app",
      installationId: String(opts.installationId),
    },
    meta as unknown as Record<string, unknown>
  );

  for (const other of INTEGRATION_SITE_PLATFORMS) {
    if (other === "github") continue;
    await disconnectIntegration(opts.brandId, other);
  }

  const map = capabilityMapFor(githubAdapter);
  try {
    await persistBrandWriter(opts.brandId, "github", map);
    await detectAndStoreSourceOfTruth(opts.brandId, brand.site_url || "", "github");
    await confirmSourceOfTruth(opts.brandId, "github");
  } catch {
    await disconnectIntegration(opts.brandId, "github");
    return { ok: false, error: "Could not save the publishing connection. Please try again." };
  }

  return { ok: true };
}

export async function getGitHubAppConnection(brandId: string): Promise<GitHubAppConnectionMeta | null> {
  const row = await getIntegration(brandId, "github");
  if (!row || row.status !== "connected") return null;
  return parseGitHubAppMeta(row.metadata as Record<string, unknown>);
}

export async function disconnectGitHubApp(brandId: string): Promise<void> {
  const active = await findConnectedIntegration(brandId, ["github"]);
  if (active) await disconnectIntegration(brandId, "github");
  const brand = await getBrandById(brandId);
  if (brand?.primary_writer === "github") {
    await clearBrandWriter(brandId);
  }
}
