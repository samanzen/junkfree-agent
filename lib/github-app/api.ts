import { tryCreateAppJwt, githubAppConfigured } from "./auth";

export type GhJson = Record<string, unknown> | unknown[] | null;

async function appRequest(
  path: string,
  init: RequestInit = {},
  token?: string
): Promise<{ ok: boolean; status: number; body: GhJson; error?: string }> {
  let auth = "";
  if (token) {
    auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  } else if (githubAppConfigured()) {
    const jwt = tryCreateAppJwt();
    if (!jwt.ok) return { ok: false, status: 0, body: null, error: jwt.error };
    auth = `Bearer ${jwt.jwt}`;
  }
  if (!auth) return { ok: false, status: 0, body: null, error: "GitHub App is not configured." };
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: auth,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Volo-Website-Connection",
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let body: GhJson = null;
    try {
      body = text ? (JSON.parse(text) as GhJson) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const msg =
        body && typeof body === "object" && !Array.isArray(body) && typeof (body as { message?: string }).message === "string"
          ? (body as { message: string }).message
          : `HTTP ${res.status}`;
      return { ok: false, status: res.status, body, error: msg };
    }
    return { ok: true, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Short-lived installation token — never persist permanently. */
export async function createInstallationToken(installationId: number): Promise<
  { ok: true; token: string; expiresAt: string } | { ok: false; error: string }
> {
  const r = await appRequest(`/app/installations/${installationId}/access_tokens`, { method: "POST" });
  if (!r.ok) return { ok: false, error: r.error || "Could not create installation token." };
  const body = r.body as { token?: string; expires_at?: string } | null;
  if (!body?.token) return { ok: false, error: "GitHub did not return an installation token." };
  return { ok: true, token: body.token, expiresAt: body.expires_at || "" };
}

export async function getInstallation(installationId: number): Promise<
  | {
      ok: true;
      id: number;
      accountLogin: string;
      accountType: string;
      accountId: number;
      suspended: boolean;
      repositorySelection: string;
    }
  | { ok: false; error: string; status?: number }
> {
  const r = await appRequest(`/app/installations/${installationId}`);
  if (!r.ok) return { ok: false, error: r.error || "Installation not found.", status: r.status };
  const body = r.body as {
    id?: number;
    suspended_at?: string | null;
    repository_selection?: string;
    account?: { login?: string; type?: string; id?: number };
  } | null;
  if (!body?.id || !body.account?.login) return { ok: false, error: "Installation payload incomplete." };
  return {
    ok: true,
    id: body.id,
    accountLogin: body.account.login,
    accountType: body.account.type || "User",
    accountId: body.account.id || 0,
    suspended: !!body.suspended_at,
    repositorySelection: body.repository_selection || "selected",
  };
}

export type InstallationRepo = {
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

export async function listInstallationRepos(
  installationToken: string
): Promise<{ ok: true; repos: InstallationRepo[] } | { ok: false; error: string }> {
  const repos: InstallationRepo[] = [];
  let page = 1;
  for (;;) {
    const r = await appRequest(
      `/installation/repositories?per_page=100&page=${page}`,
      {},
      installationToken
    );
    if (!r.ok) return { ok: false, error: r.error || "Could not list repositories." };
    const body = r.body as { repositories?: unknown[]; total_count?: number } | null;
    const batch = Array.isArray(body?.repositories) ? body!.repositories! : [];
    for (const raw of batch) {
      const repo = raw as {
        id?: number;
        name?: string;
        full_name?: string;
        private?: boolean;
        default_branch?: string;
        html_url?: string;
        homepage?: string | null;
        description?: string | null;
        owner?: { login?: string };
      };
      if (!repo.id || !repo.name || !repo.full_name) continue;
      repos.push({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: !!repo.private,
        defaultBranch: repo.default_branch || "main",
        htmlUrl: repo.html_url || "",
        homepage: repo.homepage || null,
        description: repo.description || null,
        ownerLogin: repo.owner?.login || repo.full_name.split("/")[0] || "",
      });
    }
    if (batch.length < 100) break;
    page += 1;
    if (page > 20) break;
  }
  return { ok: true, repos };
}

export async function getRepoContent(
  installationToken: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<{ ok: true; text: string } | { ok: false; status: number; error?: string }> {
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const encoded = path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const r = await appRequest(`/repos/${owner}/${repo}/contents/${encoded}${q}`, {}, installationToken);
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  const body = r.body as { content?: string; encoding?: string; type?: string } | null;
  if (!body || body.type === "dir" || !body.content) return { ok: false, status: 404 };
  const text = Buffer.from(body.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { ok: true, text };
}

export async function listRepoDir(
  installationToken: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<string[]> {
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const encoded = path
    ? path
        .split("/")
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/")
    : "";
  const r = await appRequest(
    `/repos/${owner}/${repo}/contents/${encoded}${q}`,
    {},
    installationToken
  );
  if (!r.ok || !Array.isArray(r.body)) return [];
  return (r.body as { name?: string; type?: string }[])
    .filter((e) => e.type === "dir" || e.type === "file")
    .map((e) => e.name || "")
    .filter(Boolean);
}
