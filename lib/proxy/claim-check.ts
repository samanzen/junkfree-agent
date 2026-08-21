// Namespace claim-check: refuse to own a path the customer site already serves.

import { randomBytes } from "crypto";
import type { ProxyClaimCheck, ProxyClaimResult } from "../execution/proxy-token";
import { isProxyNamespace, normalizeProxyNamespace } from "../execution/proxy-token";

const FETCH_MS = 10_000;

export type Probe = {
  path: string;
  status: number | null;
  note?: string;
  headers?: Record<string, string>;
  /** Present only while resolving redirects inside probe(). */
  location?: string;
};

async function probeOnce(origin: string, path: string): Promise<Probe> {
  const url = `${origin.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_MS),
      headers: { "User-Agent": "SEO-Platform-ClaimCheck" },
    });
    const headers: Record<string, string> = {};
    const fingerprint = res.headers.get("x-proxy-origin");
    if (fingerprint) headers["x-proxy-origin"] = fingerprint;
    const location = res.headers.get("location") || undefined;
    return {
      path,
      status: res.status,
      note: res.status >= 300 && res.status < 400 ? `redirect ${location || ""}`.trim() : undefined,
      headers,
      location,
    };
  } catch (e) {
    return {
      path,
      status: null,
      note: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Follow same-origin redirects (trailing-slash 308 → /guides → 404 is common on
 * Next/Vercel). Off-site redirects keep the 3xx status so evaluate can refuse.
 */
async function probe(origin: string, path: string): Promise<Probe> {
  const originHost = new URL(origin).origin;
  let currentPath = path;
  let last = await probeOnce(origin, currentPath);
  const hops: string[] = [];

  for (let i = 0; i < 5; i++) {
    if (last.status === null || last.status < 300 || last.status >= 400) break;
    const loc = last.location || "";
    if (!loc) break;
    let next: URL;
    try {
      next = new URL(loc, originHost);
    } catch {
      break;
    }
    if (next.origin !== originHost) {
      return {
        path,
        status: last.status,
        note: `redirect off-site ${loc}`,
        headers: last.headers,
      };
    }
    hops.push(`${last.status}→${next.pathname}`);
    currentPath = `${next.pathname}${next.search}`;
    last = await probeOnce(origin, currentPath);
  }

  if (!hops.length) {
    const { location: _drop, ...rest } = last;
    return rest;
  }
  return {
    path,
    status: last.status,
    note: `followed ${hops.join(", ")}; final ${last.status}`,
    headers: last.headers,
  };
}

function originOf(siteUrl: string): string | null {
  try {
    const u = new URL(siteUrl);
    if (u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function evaluateClaimProbes(input: {
  namespace: string;
  root: Probe;
  hub: Probe;
  leaf: Probe;
}): Omit<ProxyClaimCheck, "checked_at"> {
  const { namespace, root, hub, leaf } = input;
  const probes = [root, hub, leaf].map(({ path, status, note }) => ({ path, status, note }));

  if (root.status === null) {
    return {
      namespace,
      result: "unreachable",
      probes,
      detail: "We couldn't reach your website. Check the site address and try again.",
    };
  }

  const loop =
    root.headers?.["x-proxy-origin"] === "1" ||
    hub.headers?.["x-proxy-origin"] === "1" ||
    leaf.headers?.["x-proxy-origin"] === "1";
  if (loop) {
    return {
      namespace,
      result: "loop",
      probes,
      detail:
        "This path already points at our publishing server. Remove the old rewrite first, then try again.",
    };
  }

  if (hub.status === 200) {
    return {
      namespace,
      result: "collision",
      probes,
      detail: `Your site already serves /${namespace}/. Choose a different path so we don't cover existing pages.`,
    };
  }

  // Catch-all: hub 404 but random leaf 200 — rewrite will still win, but warn.
  if ((hub.status === 404 || hub.status === 410) && leaf.status === 200) {
    return {
      namespace,
      result: "clear",
      probes: probes.map((p) =>
        p.path.includes("__probe-")
          ? { ...p, note: "Your site returns a page for unknown URLs (catch-all)." }
          : p
      ),
      detail: `Path /${namespace}/ looks free. Your site has a catch-all page for unknown URLs — that's OK; our rewrite still takes priority once installed.`,
    };
  }

  if (hub.status !== null && hub.status !== 404 && hub.status !== 410 && hub.status < 500) {
    // Unexpected status on hub (403, soft pages, etc.)
    if (hub.status >= 200 && hub.status < 400) {
      return {
        namespace,
        result: "collision",
        probes,
        detail: `Your site already responds at /${namespace}/. Choose a different path.`,
      };
    }
  }

  return {
    namespace,
    result: "clear",
    probes,
    detail: `Path /${namespace}/ is free. Next: add one config change on your host, then prove publishing.`,
  };
}

export async function runNamespaceClaimCheck(
  siteUrl: string,
  rawNamespace: string
): Promise<ProxyClaimCheck> {
  const namespace = normalizeProxyNamespace(rawNamespace);
  const checked_at = new Date().toISOString();

  if (!isProxyNamespace(namespace)) {
    return {
      namespace,
      result: "error",
      probes: [],
      checked_at,
      detail: "That path name isn't allowed. Use lowercase letters, numbers, and hyphens.",
    };
  }

  const origin = originOf(siteUrl);
  if (!origin) {
    return {
      namespace,
      result: "error",
      probes: [],
      checked_at,
      detail: "Your brand needs an https:// website address before we can check the path.",
    };
  }

  const probeId = randomBytes(4).toString("hex");
  const [root, hub, leaf] = await Promise.all([
    probe(origin, "/"),
    probe(origin, `/${namespace}/`),
    probe(origin, `/${namespace}/__probe-${probeId}`),
  ]);

  const evaluated = evaluateClaimProbes({ namespace, root, hub, leaf });
  return { ...evaluated, checked_at };
}

export function claimAllowsSetup(result: ProxyClaimResult): boolean {
  return result === "clear";
}
