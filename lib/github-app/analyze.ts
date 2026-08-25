import type { InstallationRepo } from "./api";
import { getRepoContent, listRepoDir } from "./api";

export type RepoAnalysis = {
  repoId: number;
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  framework: string | null;
  packageManager: string | null;
  contentPath: string | null;
  hasBlogHints: boolean;
  hasSitemapHints: boolean;
  deploymentProvider: string | null;
  likelyDomain: string | null;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  evidence: string[];
  canCreateBranch: boolean;
  canOpenPullRequest: boolean;
  canUpdateContent: boolean;
};

const CONTENT_FROM_ROOT = [
  "content",
  "src",
  "app",
  "data",
  "docs",
  "blog",
  "posts",
  "pages",
];

function scoreDomainMatch(siteHost: string | null, candidates: (string | null | undefined)[]): number {
  if (!siteHost) return 0;
  const host = siteHost.replace(/^www\./, "").toLowerCase();
  const stem = host.split(".")[0] || "___";
  let score = 0;
  for (const c of candidates) {
    if (!c) continue;
    const v = c.toLowerCase();
    if (v.includes(host)) score += 40;
    if (v.includes(stem)) score += 10;
  }
  return score;
}

function siteHostFrom(siteUrl: string | null): string | null {
  try {
    if (!siteUrl) return null;
    return new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Cheap metadata-only score — no GitHub content API calls. */
export function scoreRepoMetadata(repo: InstallationRepo, siteUrl: string | null): number {
  const siteHost = siteHostFrom(siteUrl);
  let score = 5;
  score += scoreDomainMatch(siteHost, [repo.homepage, repo.description, repo.htmlUrl, repo.name, repo.fullName]);
  if (repo.homepage) score += 5;
  return score;
}

/**
 * Lightweight repo analysis — few API calls to avoid installation rate limits.
 * Uses root directory listing + package.json instead of probing many paths.
 */
export async function analyzeRepository(
  installationToken: string,
  repo: InstallationRepo,
  siteUrl: string | null
): Promise<RepoAnalysis> {
  const [owner, name] = repo.fullName.split("/");
  const evidence: string[] = [];
  let score = scoreRepoMetadata(repo, siteUrl);
  let framework: string | null = null;
  let packageManager: string | null = null;
  let contentPath: string | null = null;
  let hasBlogHints = false;
  let hasSitemapHints = false;
  let deploymentProvider: string | null = null;
  let likelyDomain: string | null = repo.homepage || null;
  const siteHost = siteHostFrom(siteUrl);

  if (repo.homepage) evidence.push(`Homepage set to ${repo.homepage}`);
  if (siteHost && (repo.name.toLowerCase().includes(siteHost.split(".")[0] || "") || repo.fullName.toLowerCase().includes(siteHost.split(".")[0] || ""))) {
    evidence.push("Repository name relates to the website host");
  }

  const root = await listRepoDir(installationToken, owner, name, "", repo.defaultBranch);
  const rootSet = new Set(root.map((n) => n.toLowerCase()));

  if (rootSet.has("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (rootSet.has("yarn.lock")) packageManager = "yarn";
  else if (rootSet.has("package-lock.json")) packageManager = "npm";

  if (rootSet.has("vercel.json")) {
    deploymentProvider = "Vercel";
    score += 15;
    evidence.push("vercel.json present");
  } else if (rootSet.has("netlify.toml")) {
    deploymentProvider = "Netlify";
    score += 12;
    evidence.push("netlify.toml present");
  } else if (rootSet.has("wrangler.toml")) {
    deploymentProvider = "Cloudflare";
    score += 10;
  }

  if (
    rootSet.has("next.config.js") ||
    rootSet.has("next.config.mjs") ||
    rootSet.has("next.config.ts")
  ) {
    framework = "Next.js";
    score += 10;
    evidence.push("Next.js config file present");
  }

  for (const candidate of CONTENT_FROM_ROOT) {
    if (rootSet.has(candidate.toLowerCase()) || rootSet.has(candidate)) {
      if (candidate === "src" || candidate === "app") {
        // Prefer nested content dirs when present; probe once.
        const nested = await listRepoDir(
          installationToken,
          owner,
          name,
          candidate === "src" ? "src/content" : "app",
          repo.defaultBranch
        );
        if (candidate === "src" && nested.length) {
          contentPath = "src/content";
          score += 8;
          evidence.push("Content folder candidate: src/content");
          break;
        }
        if (candidate === "app" && nested.some((n) => /page|blog|content/i.test(n))) {
          contentPath = "app";
          score += 6;
          evidence.push("App router structure detected");
          break;
        }
        continue;
      }
      contentPath = candidate;
      score += 8;
      evidence.push(`Content folder candidate: ${candidate}`);
      if (/blog|posts|content/i.test(candidate)) hasBlogHints = true;
      break;
    }
  }

  if (rootSet.has("package.json")) {
    const pkg = await getRepoContent(installationToken, owner, name, "package.json", repo.defaultBranch);
    if (pkg.ok) {
      evidence.push("Found package.json");
      score += 15;
      try {
        const json = JSON.parse(pkg.text) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
          scripts?: Record<string, string>;
        };
        const deps = { ...(json.dependencies || {}), ...(json.devDependencies || {}) };
        if (deps.next) {
          framework = "Next.js";
          score += 20;
          evidence.push("Next.js dependency detected");
        } else if (deps.nuxt) {
          framework = "Nuxt";
          score += 15;
        } else if (deps.astro) {
          framework = "Astro";
          score += 15;
        } else if (deps.gatsby) {
          framework = "Gatsby";
          score += 10;
        } else if (deps.react) {
          framework = framework || "React";
          score += 8;
        } else if (deps.vue) {
          framework = framework || "Vue";
          score += 8;
        }
        const scripts = Object.values(json.scripts || {}).join(" ");
        if (/contentlayer|mdx|markdown/i.test(scripts + JSON.stringify(deps))) {
          hasBlogHints = true;
          evidence.push("Markdown/MDX tooling detected");
        }
      } catch {
        /* ignore */
      }
    } else if (/rate limit/i.test(pkg.error || "")) {
      evidence.push("Analysis limited by GitHub rate limits");
    }
  }

  let confidence: RepoAnalysis["confidence"] = "low";
  if (score >= 55) confidence = "high";
  else if (score >= 30) confidence = "medium";

  return {
    repoId: repo.id,
    fullName: repo.fullName,
    owner: owner || repo.ownerLogin,
    name: name || repo.name,
    private: repo.private,
    defaultBranch: repo.defaultBranch,
    framework,
    packageManager,
    contentPath,
    hasBlogHints,
    hasSitemapHints,
    deploymentProvider,
    likelyDomain: likelyDomain || (siteHost ? `https://${siteHost}` : null),
    confidence,
    confidenceScore: score,
    evidence,
    canCreateBranch: true,
    canOpenPullRequest: true,
    canUpdateContent: true,
  };
}

export function rankReposForSite(
  analyses: RepoAnalysis[]
): { best: RepoAnalysis | null; ambiguous: boolean } {
  if (!analyses.length) return { best: null, ambiguous: false };
  const sorted = [...analyses].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const best = sorted[0];
  const second = sorted[1];
  if (best.confidence === "high" && (!second || best.confidenceScore - second.confidenceScore >= 15)) {
    return { best, ambiguous: false };
  }
  return { best: best.confidence !== "low" ? best : null, ambiguous: true };
}

/** Pre-sort repos by metadata, deep-analyze only the top N. */
export function pickReposToAnalyze(
  repos: InstallationRepo[],
  siteUrl: string | null,
  limit = 8
): InstallationRepo[] {
  return [...repos]
    .sort((a, b) => scoreRepoMetadata(b, siteUrl) - scoreRepoMetadata(a, siteUrl))
    .slice(0, Math.max(1, limit));
}

export function isRateLimitMessage(msg: string | null | undefined): boolean {
  return !!msg && /rate limit/i.test(msg);
}
