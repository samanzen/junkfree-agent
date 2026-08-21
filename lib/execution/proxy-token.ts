// Proxy site token + namespace helpers.
//
// Token generation lives in app code (not a DB default). Format is enforced
// by supabase/022_proxy_publishing.sql and mirrored here for connect/UI.

import { randomBytes } from "crypto";

const RESERVED_NAMESPACES = new Set([
  "api",
  "admin",
  "wp-admin",
  "wp-content",
  "wp-json",
  "static",
  "assets",
  "_next",
  "cdn",
  "app",
  "login",
  "cart",
  "checkout",
  "account",
  "s",
]);

export const SUGGESTED_NAMESPACES = ["guides", "resources", "areas", "services"] as const;

const TOKEN_RE = /^site_[0-9a-f]{32}$/;
const NAMESPACE_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;

export type ProxyClaimResult = "clear" | "collision" | "loop" | "unreachable" | "error";

export type ProxyClaimCheck = {
  namespace: string;
  result: ProxyClaimResult;
  probes: Array<{ path: string; status: number | null; note?: string }>;
  checked_at: string;
  detail: string;
};

export function newProxySiteToken(): string {
  return `site_${randomBytes(16).toString("hex")}`;
}

export function isProxySiteToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

export function isProxyNamespace(value: unknown): value is string {
  return (
    typeof value === "string" &&
    NAMESPACE_RE.test(value) &&
    !RESERVED_NAMESPACES.has(value)
  );
}

/** Customer-facing validation for the Connect UI (same rules as migration 022). */
export function namespaceValidationError(raw: string): string | null {
  const ns = normalizeProxyNamespace(raw);
  if (!ns) return "Choose a path name for new pages.";
  if (!NAMESPACE_RE.test(ns)) {
    return "Use lowercase letters, numbers, and hyphens (2–31 characters).";
  }
  if (RESERVED_NAMESPACES.has(ns)) {
    return `"${ns}" is reserved. Pick another path name.`;
  }
  return null;
}

export function normalizeProxyNamespace(raw: string): string {
  return (raw || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

export function emptyProxyClaimCheck(): ProxyClaimCheck {
  return {
    namespace: "",
    result: "error",
    probes: [],
    checked_at: "",
    detail: "",
  };
}

export function parseProxyClaimCheck(raw: unknown): ProxyClaimCheck | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const result = r.result;
  if (
    result !== "clear" &&
    result !== "collision" &&
    result !== "loop" &&
    result !== "unreachable" &&
    result !== "error"
  ) {
    return null;
  }
  if (typeof r.namespace !== "string" || typeof r.checked_at !== "string" || typeof r.detail !== "string") {
    return null;
  }
  const probes = Array.isArray(r.probes)
    ? r.probes
        .filter((p): p is { path: string; status: number | null; note?: string } => {
          if (!p || typeof p !== "object" || Array.isArray(p)) return false;
          const row = p as Record<string, unknown>;
          return (
            typeof row.path === "string" &&
            (row.status === null || typeof row.status === "number")
          );
        })
        .slice(0, 16)
    : [];
  return {
    namespace: r.namespace,
    result,
    probes,
    checked_at: r.checked_at,
    detail: r.detail,
  };
}
