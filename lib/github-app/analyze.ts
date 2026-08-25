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

const CONTENT_CANDIDATES = [
  "content",
  "src/content",
  "app/content",
  "data",
  "docs",
  "blog",
  "posts",
  "pages",
  "src/pages",
  "app/(marketing)",
];

function scoreDomainMatch(siteHost: string | null, candidates: (string | null | undefined)[]): number {
  if (!siteHost) return 0;
  const host = siteHost.replace(/^www\./, "").toLowerCase();
  let score = 0;
  for (const c of candidates) {
    if (!c) continue;
    const v = c.toLowerCase();
    if (v.includes(host)) score += 40;
    if (v.includes(host.split(".")[0] || "___")) score += 10;
  }
  return score;
}

export async function analyzeRepository(
  installationToken: string,
  repo: InstallationRepo,
  siteUrl: string | null
): Promise<RepoAnalysis> {
  const [owner, name] = repo.fullName.split("/");
  const evidence: string[] = [];
  let score = 10;
  let framework: string | null = null;
  let packageManager: string | null = null;
  let contentPath: string | null = null;
  let hasBlogHints = false;
  let hasSitemapHints = false;
  let deploymentProvider: string | null = null;
  let likelyDomain: string | null = repo.homepage || null;

  let siteHost: string | null = null;
  try {
    if (siteUrl) siteHost = new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    siteHost = null;
  }

  score += scoreDomainMatch(siteHost, [repo.homepage, repo.description, repo.htmlUrl, repo.name, repo.fullName]);
  if (repo.homepage) evidence.push(`Homepage set to ${repo.homepage}`);

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
        framework = "React";
        score += 8;
      } else if (deps.vue) {
        framework = "Vue";
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
  }

  const lock =
    (await getRepoContent(installationToken, owner, name, "pnpm-lock.yaml", repo.defaultBranch)).ok
      ? "pnpm"
      : (await getRepoContent(installationToken, owner, name, "yarn.lock", repo.defaultBranch)).ok
        ? "yarn"
        : (await getRepoContent(installationToken, owner, name, "package-lock.json", repo.defaultBranch)).ok
          ? "npm"
          : null;
  if (lock) packageManager = lock;

  if ((await getRepoContent(installationToken, owner, name, "vercel.json", repo.defaultBranch)).ok) {
    deploymentProvider = "Vercel";
    score += 15;
    evidence.push("vercel.json present");
  } else if ((await getRepoContent(installationToken, owner, name, "netlify.toml", repo.defaultBranch)).ok) {
    deploymentProvider = "Netlify";
    score += 12;
    evidence.push("netlify.toml present");
  } else if (
    (await getRepoContent(installationToken, owner, name, "wrangler.toml", repo.defaultBranch)).ok
  ) {
    deploymentProvider = "Cloudflare";
    score += 10;
  }

  for (const candidate of CONTENT_CANDIDATES) {
    const entries = await listRepoDir(installationToken, owner, name, candidate, repo.defaultBranch);
    if (entries.length) {
      contentPath = candidate;
      score += 8;
      evidence.push(`Content folder candidate: ${candidate}`);
      if (/blog|posts|content/i.test(candidate)) hasBlogHints = true;
      break;
    }
  }

  const nextConfig =
    (await getRepoContent(installationToken, owner, name, "next.config.js", repo.defaultBranch)).ok ||
    (await getRepoContent(installationToken, owner, name, "next.config.mjs", repo.defaultBranch)).ok ||
    (await getRepoContent(installationToken, owner, name, "next.config.ts", repo.defaultBranch)).ok;
  if (nextConfig) {
    framework = framework || "Next.js";
    score += 10;
    evidence.push("Next.js config file present");
  }

  const readme = await getRepoContent(installationToken, owner, name, "README.md", repo.defaultBranch);
  if (readme.ok) {
    score += scoreDomainMatch(siteHost, [readme.text.slice(0, 4000)]);
    if (/sitemap/i.test(readme.text)) hasSitemapHints = true;
    if (/vercel|netlify|cloudflare/i.test(readme.text) && !deploymentProvider) {
      const m = readme.text.match(/\b(Vercel|Netlify|Cloudflare)\b/i);
      if (m) deploymentProvider = m[1];
    }
  }

  if (siteHost && (repo.name.toLowerCase().includes(siteHost.split(".")[0] || "") || repo.fullName.toLowerCase().includes(siteHost.split(".")[0] || ""))) {
    evidence.push("Repository name relates to the website host");
  }

  let confidence: RepoAnalysis["confidence"] = "low";
  if (score >= 55) confidence = "high";
  else if (score >= 30) confidence = "medium";

  return {
    repoId: repo.id,
    fullName: repo.fullName,
    owner,
    name,
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
