/**
 * GitHub adapter — coded-site publishing via pull request.
 *
 * Never writes directly to the default branch. Flow:
 *   check token/repo → create branch → commit file(s) → open PR
 *
 * Credentials: { token }
 * Config: { owner, repo, baseBranch?, contentPath?, defaultBranch? }
 */

import type { AdapterContext, PublishAdapter, PublishResult, SiteChange } from "../types";

type GhFile = { path: string; sha?: string; content?: string };

function cfg(ctx: AdapterContext) {
  const owner = String(ctx.config.owner || "").trim();
  const repo = String(ctx.config.repo || "").trim();
  const baseBranch = String(ctx.config.baseBranch || ctx.config.defaultBranch || "main").trim() || "main";
  const contentPath = String(ctx.config.contentPath || "content").trim().replace(/^\/+|\/+$/g, "") || "content";
  return { owner, repo, baseBranch, contentPath };
}

function token(ctx: AdapterContext): string {
  return (ctx.credentials.token || ctx.credentials.accessToken || "").trim();
}

async function gh(
  ctx: AdapterContext,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const t = token(ctx);
  if (!t) return { ok: false, status: 0, body: null, error: "GitHub token is required." };
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${t}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "Volo-Website-Connection",
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function filePathFor(contentPath: string, slug: string, kind: "page" | "meta"): string {
  const clean = slug.replace(/^\/+|\/+$/g, "").replace(/\.\./g, "");
  if (kind === "meta") return `${contentPath}/${clean}.meta.json`;
  return `${contentPath}/${clean}.md`;
}

function markdownDoc(change: Extract<SiteChange, { type: "upsert_page" }>): string {
  const desc = (change.metaDescription || "").replace(/"/g, '\\"');
  return `---\ntitle: "${change.title.replace(/"/g, '\\"')}"\ndescription: "${desc}"\n---\n\n${change.bodyMarkdown}\n`;
}

async function getRefSha(ctx: AdapterContext, owner: string, repo: string, branch: string): Promise<string | null> {
  const r = await gh(ctx, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  if (!r.ok) return null;
  const sha = (r.body as { object?: { sha?: string } } | null)?.object?.sha;
  return typeof sha === "string" ? sha : null;
}

async function ensureBranch(
  ctx: AdapterContext,
  owner: string,
  repo: string,
  baseBranch: string,
  newBranch: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const baseSha = await getRefSha(ctx, owner, repo, baseBranch);
  if (!baseSha) return { ok: false, error: `Could not read branch "${baseBranch}". Check repo access and branch name.` };
  const existing = await getRefSha(ctx, owner, repo, newBranch);
  if (existing) return { ok: true };
  const created = await gh(ctx, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: baseSha }),
  });
  if (!created.ok) {
    const msg = (created.body as { message?: string } | null)?.message || `HTTP ${created.status}`;
    return { ok: false, error: `Could not create branch: ${msg}` };
  }
  return { ok: true };
}

async function putFile(
  ctx: AdapterContext,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string
): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  const existing = await gh(
    ctx,
    `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`
  );
  const sha = existing.ok ? (existing.body as GhFile).sha : undefined;
  const put = await gh(ctx, `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!put.ok) {
    const msg = (put.body as { message?: string } | null)?.message || `HTTP ${put.status}`;
    return { ok: false, error: msg };
  }
  const newSha = (put.body as { content?: { sha?: string } } | null)?.content?.sha || "ok";
  return { ok: true, sha: newSha };
}

async function openPr(
  ctx: AdapterContext,
  owner: string,
  repo: string,
  baseBranch: string,
  head: string,
  title: string,
  body: string
): Promise<{ ok: true; url: string; number: number } | { ok: false; error: string }> {
  const r = await gh(ctx, `/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, head, base: baseBranch, body }),
  });
  if (!r.ok) {
    // If PR already exists for this branch, treat as success.
    if (r.status === 422) {
      const list = await gh(ctx, `/repos/${owner}/${repo}/pulls?head=${owner}:${head}&state=open`);
      const first = Array.isArray(list.body) ? (list.body as { html_url?: string; number?: number }[])[0] : null;
      if (first?.html_url && first.number) {
        return { ok: true, url: first.html_url, number: first.number };
      }
    }
    const msg = (r.body as { message?: string } | null)?.message || `HTTP ${r.status}`;
    return { ok: false, error: msg };
  }
  const pr = r.body as { html_url?: string; number?: number };
  if (!pr.html_url || !pr.number) return { ok: false, error: "GitHub did not return a pull request URL." };
  return { ok: true, url: pr.html_url, number: pr.number };
}

export const githubAdapter: PublishAdapter = {
  provider: "github",
  label: "GitHub",
  capabilities: ["upsert_page", "update_meta"],

  async check(ctx) {
    const { owner, repo, baseBranch } = cfg(ctx);
    if (!owner || !repo) return { ok: false, detail: "GitHub owner and repository are required." };
    if (!token(ctx)) return { ok: false, detail: "A GitHub personal access token with repo access is required." };
    const r = await gh(ctx, `/repos/${owner}/${repo}`);
    if (r.status === 401 || r.status === 403) {
      return { ok: false, detail: "GitHub rejected the token. Check scopes (repo) and access to this repository." };
    }
    if (r.status === 404) return { ok: false, detail: "Repository not found. Check owner/repo and token access." };
    if (!r.ok) {
      return { ok: false, detail: (r.body as { message?: string } | null)?.message || `GitHub HTTP ${r.status}` };
    }
    const sha = await getRefSha(ctx, owner, repo, baseBranch);
    if (!sha) {
      return {
        ok: false,
        detail: `Connected to ${owner}/${repo}, but branch "${baseBranch}" was not found.`,
      };
    }
    return {
      ok: true,
      detail: `Connected to ${owner}/${repo} (${baseBranch}). Changes will open as pull requests — never silent production edits.`,
    };
  },

  async apply(ctx, change: SiteChange): Promise<PublishResult> {
    const { owner, repo, baseBranch, contentPath } = cfg(ctx);
    if (!owner || !repo) return { ok: false, error: "GitHub owner/repo missing.", retryable: false };

    if (change.type === "delete_page") {
      const { owner, repo, baseBranch, contentPath } = cfg(ctx);
      // Certify encodes remoteId as "prNumber::branch::path"
      const parts = (change.remoteId || "").split("::");
      if (parts.length === 3) {
        const [, branch, path] = parts;
        const existing = await gh(
          ctx,
          `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`
        );
        if (!existing.ok) {
          return { ok: true, remoteId: change.remoteId, url: null, previous: null };
        }
        const sha = (existing.body as GhFile).sha;
        const del = await gh(ctx, `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
          method: "DELETE",
          body: JSON.stringify({
            message: `chore(seo): remove canary ${path}`,
            sha,
            branch,
          }),
        });
        if (!del.ok && del.status !== 404) {
          return {
            ok: false,
            error: (del.body as { message?: string } | null)?.message || "Could not delete canary file",
            retryable: del.status >= 500,
          };
        }
        return { ok: true, remoteId: change.remoteId, url: null, previous: null };
      }
      const branch = `volo/delete-${Date.now().toString(36)}`;
      const ensured = await ensureBranch(ctx, owner, repo, baseBranch, branch);
      if (!ensured.ok) return { ok: false, error: ensured.error, retryable: false };
      const path = filePathFor(contentPath, change.slug, "page");
      const existing = await gh(
        ctx,
        `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(baseBranch)}`
      );
      if (!existing.ok) {
        return { ok: true, remoteId: change.slug, url: null, previous: null };
      }
      const sha = (existing.body as GhFile).sha;
      const del = await gh(ctx, `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
        method: "DELETE",
        body: JSON.stringify({ message: `chore(seo): remove ${path}`, sha, branch }),
      });
      if (!del.ok) {
        return {
          ok: false,
          error: (del.body as { message?: string } | null)?.message || "Could not delete file",
          retryable: del.status >= 500,
        };
      }
      const pr = await openPr(
        ctx,
        owner,
        repo,
        baseBranch,
        branch,
        `Remove ${path}`,
        "Automated by Volo Website Connection. Review and merge to apply."
      );
      if (!pr.ok) return { ok: false, error: pr.error, retryable: false };
      return { ok: true, remoteId: String(pr.number), url: pr.url, previous: null };
    }

    if (change.type === "update_meta") {
      const slug = (() => {
        try {
          const u = new URL(change.url);
          return u.pathname.replace(/^\/+|\/+$/g, "") || "index";
        } catch {
          return change.url.replace(/^\/+|\/+$/g, "");
        }
      })();
      const branch = `volo/meta-${Date.now().toString(36)}`;
      const ensured = await ensureBranch(ctx, owner, repo, baseBranch, branch);
      if (!ensured.ok) return { ok: false, error: ensured.error, retryable: false };
      const path = filePathFor(contentPath, slug, "page");
      const existing = await gh(
        ctx,
        `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(baseBranch)}`
      );
      if (!existing.ok) {
        return { ok: false, error: `No content file at ${path} to update meta for.`, retryable: false };
      }
      const raw = Buffer.from((existing.body as { content?: string }).content || "", "base64").toString("utf8");
      let next = raw;
      if (change.title) {
        next = next.replace(/^title:\s*["'].*["']\s*$/m, `title: "${change.title.replace(/"/g, '\\"')}"`);
        if (!/^title:/m.test(next) && next.startsWith("---")) {
          next = next.replace(/^---\n/, `---\ntitle: "${change.title.replace(/"/g, '\\"')}"\n`);
        }
      }
      if (change.metaDescription) {
        const d = change.metaDescription.replace(/"/g, '\\"');
        if (/^description:/m.test(next)) {
          next = next.replace(/^description:\s*["'].*["']\s*$/m, `description: "${d}"`);
        } else if (next.startsWith("---")) {
          next = next.replace(/^---\n/, `---\ndescription: "${d}"\n`);
        }
      }
      const put = await putFile(ctx, owner, repo, branch, path, next, `seo: update meta for ${slug}`);
      if (!put.ok) return { ok: false, error: put.error, retryable: false };
      const pr = await openPr(
        ctx,
        owner,
        repo,
        baseBranch,
        branch,
        `SEO meta: ${slug}`,
        "Automated by Volo. Review the frontmatter changes, merge, then deploy."
      );
      if (!pr.ok) return { ok: false, error: pr.error, retryable: false };
      return { ok: true, remoteId: String(pr.number), url: pr.url, previous: { content: raw } };
    }

    if (change.type !== "upsert_page") {
      return { ok: false, error: `GitHub adapter cannot perform "${(change as { type: string }).type}".`, retryable: false };
    }

    const branch = `volo/page-${change.slug.replace(/[^\w-]+/g, "-").slice(0, 40)}-${Date.now().toString(36)}`;
    const ensured = await ensureBranch(ctx, owner, repo, baseBranch, branch);
    if (!ensured.ok) return { ok: false, error: ensured.error, retryable: false };
    const path = filePathFor(contentPath, change.slug, "page");
    const body = markdownDoc(change);
    const put = await putFile(ctx, owner, repo, branch, path, body, `seo: publish ${change.slug}`);
    if (!put.ok) return { ok: false, error: put.error, retryable: false };
    const pr = await openPr(
      ctx,
      owner,
      repo,
      baseBranch,
      branch,
      `Publish ${change.title}`,
      [
        "Automated by Volo Website Connection.",
        "",
        "Flow: scan → propose → pull request → your merge/deploy → verify.",
        "This never writes directly to production.",
        "",
        `File: \`${path}\``,
      ].join("\n")
    );
    if (!pr.ok) return { ok: false, error: pr.error, retryable: false };
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    return {
      ok: true,
      remoteId: `${pr.number}::${branch}::${path}`,
      // Prove checks the branch file (system of record), not production.
      url: rawUrl,
      previous: { canaryCandidate: true, branch, path, pullRequest: pr.url },
    };
  },
};
