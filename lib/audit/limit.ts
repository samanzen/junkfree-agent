// ABUSE LIMITS for the public, unauthenticated audit endpoint.
//
// /api/audit is the only route in the product that does real work for someone
// who has not signed in, so it is the only one an anonymous visitor can use to
// burn our egress and turn us into a scanner aimed at third-party sites.
//
// Two layers, because neither alone is right:
//
//   Postgres (supabase/015_anon_audit_limits.sql) is the real limiter. It is
//   shared across serverless instances, which is the only way a count means
//   anything when requests land on different machines.
//
//   An in-process counter is the fallback for when that migration has NOT been
//   applied yet. It only limits the instance it lives on, so it is genuinely
//   weaker — but "weaker" beats "absent" for a public endpoint, and this
//   matches how lib/rateLimit.ts and lib/queue.ts already degrade.
//
// The client key is a SALTED HASH of the IP, never the IP. This endpoint should
// not quietly become a visitor log.

import { createHash } from "crypto";
import { db } from "../supabase";

/** Audits allowed per client per window. Generous for a human, hostile to a script. */
export const ANON_AUDIT_LIMIT = 5;
export const ANON_AUDIT_WINDOW_SECONDS = 900; // 15 minutes

export type AnonLimitResult = {
  allowed: boolean;
  used: number;
  limit: number;
  resetAt: string | null;
  /** True when the shared counter was unavailable and the fallback was used. */
  degraded: boolean;
};

const MIGRATION_MISSING_CODES = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);

/**
 * Derive the client key.
 *
 * x-forwarded-for is attacker-controllable in general, but on Vercel the
 * platform appends the real peer address as the LAST entry, so we read from the
 * right rather than the left. A spoofed prefix therefore cannot shift a caller
 * into a fresh bucket.
 */
export function clientKeyFrom(headers: Headers): string {
  const realIp = headers.get("x-real-ip");
  const forwarded = headers.get("x-forwarded-for");
  const chain = (forwarded || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = chain.length ? chain[chain.length - 1] : realIp || "unknown";

  const salt = process.env.CRON_SECRET || process.env.INTEGRATION_ENCRYPTION_KEY || "audit-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 48);
}

// ── In-process fallback ─────────────────────────────────────────────────────
// Bounded so a flood of distinct keys cannot grow this without limit.
const MAX_TRACKED_KEYS = 5_000;
const memory = new Map<string, { count: number; windowStart: number }>();

function consumeInMemory(key: string): AnonLimitResult {
  const now = Date.now();
  const windowStart = Math.floor(now / (ANON_AUDIT_WINDOW_SECONDS * 1000)) * ANON_AUDIT_WINDOW_SECONDS * 1000;

  if (memory.size > MAX_TRACKED_KEYS) {
    for (const [k, v] of memory) {
      if (v.windowStart < windowStart) memory.delete(k);
    }
    // Still oversized after pruning expired windows: drop the oldest entries
    // rather than let this grow without bound.
    if (memory.size > MAX_TRACKED_KEYS) {
      const excess = memory.size - MAX_TRACKED_KEYS;
      let removed = 0;
      for (const k of memory.keys()) {
        memory.delete(k);
        if (++removed >= excess) break;
      }
    }
  }

  const existing = memory.get(key);
  const entry =
    existing && existing.windowStart === windowStart
      ? { ...existing, count: existing.count + 1 }
      : { count: 1, windowStart };
  memory.set(key, entry);

  return {
    allowed: entry.count <= ANON_AUDIT_LIMIT,
    used: entry.count,
    limit: ANON_AUDIT_LIMIT,
    resetAt: new Date(windowStart + ANON_AUDIT_WINDOW_SECONDS * 1000).toISOString(),
    degraded: true,
  };
}

/** Consume one audit for this client. Never throws. */
export async function consumeAnonAudit(clientKey: string): Promise<AnonLimitResult> {
  try {
    const { data, error } = await db.rpc("consume_anon_audit", {
      p_client_hash: clientKey,
      p_window_seconds: ANON_AUDIT_WINDOW_SECONDS,
      p_limit: ANON_AUDIT_LIMIT,
    });

    if (error) {
      if (!MIGRATION_MISSING_CODES.has(error.code || "")) {
        console.warn(`[anonAudit] shared counter failed (${error.code}): ${error.message}`);
      }
      return consumeInMemory(clientKey);
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; used: number; limit_value: number; reset_at: string }
      | undefined;
    if (!row) return consumeInMemory(clientKey);

    return {
      allowed: !!row.allowed,
      used: row.used,
      limit: row.limit_value ?? ANON_AUDIT_LIMIT,
      resetAt: row.reset_at ?? null,
      degraded: false,
    };
  } catch {
    return consumeInMemory(clientKey);
  }
}

/** Customer-facing wording. Never mentions windows, buckets or internals. */
export function anonLimitMessage(result: AnonLimitResult): string {
  const base = "You've run several free audits already.";
  if (!result.resetAt) return `${base} Please try again shortly, or create an account to keep going.`;
  const minutes = Math.max(1, Math.ceil((Date.parse(result.resetAt) - Date.now()) / 60000));
  if (!Number.isFinite(minutes)) {
    return `${base} Please try again shortly, or create an account to keep going.`;
  }
  return `${base} Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}, or create a free account to keep going.`;
}

/** Test seam: clears the in-process counter between cases. */
export function __resetAnonAuditMemory(): void {
  memory.clear();
}
