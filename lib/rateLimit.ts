// TENANT-AWARE RATE LIMITING.
//
// Before this, no route had any inbound throttling — only /api/run had a
// cooldown. Every expensive endpoint (Claude calls, DataForSEO calls, job
// dispatch) was unmetered per tenant, so one customer, or one loop in one
// customer's browser, could exhaust the platform's AI budget for everybody.
//
// Two decisions worth stating, because both have obvious-looking alternatives:
//
//   Counters live in Postgres, not in a module. The app runs on serverless
//   instances with no shared memory, so an in-process counter limits one
//   instance and nothing in aggregate — it would look like it worked.
//
//   Limits are per (tenant, BUCKET), not per route. An AI call and a cheap
//   read should not share a budget, but every AI route reasonably can. Adding
//   a route to an existing bucket needs no new configuration.

import { NextResponse } from "next/server";
import { db } from "./supabase";
import { resolvePlan, type CapabilityScope } from "./capabilities";

/** Cost class of a route. Routes in one bucket share a tenant's budget. */
export type RateBucket =
  /** Direct Claude calls — by far the most expensive thing a request can do. */
  | "ai"
  /** Metered third-party data (DataForSEO). Cheaper than AI, still billed. */
  | "external"
  /** Enqueues work that will spend money later. */
  | "dispatch";

export type RateWindow = { limit: number; windowSeconds: number };

/**
 * Per-tenant allowances by plan. Execution capacity — not toolkit SKUs.
 * Founding is generous for normal use; Growth/Managed raise the ceiling.
 */
const PLAN_LIMITS: Record<"founding" | "growth" | "managed", Record<RateBucket, RateWindow>> = {
  founding: {
    ai: { limit: 60, windowSeconds: 3600 },
    external: { limit: 300, windowSeconds: 3600 },
    dispatch: { limit: 120, windowSeconds: 3600 },
  },
  growth: {
    ai: { limit: 180, windowSeconds: 3600 },
    external: { limit: 900, windowSeconds: 3600 },
    dispatch: { limit: 360, windowSeconds: 3600 },
  },
  managed: {
    ai: { limit: 600, windowSeconds: 3600 },
    external: { limit: 3000, windowSeconds: 3600 },
    dispatch: { limit: 1200, windowSeconds: 3600 },
  },
};

export function rateWindowFor(brand: CapabilityScope, bucket: RateBucket): RateWindow {
  return PLAN_LIMITS[resolvePlan(brand)][bucket];
}

export type RateResult = {
  allowed: boolean;
  used: number;
  limit: number;
  /** ISO timestamp when this window resets, for a Retry-After style message. */
  resetAt: string | null;
  /** True when limiting could not be evaluated and the request was let through. */
  degraded: boolean;
};

/**
 * Postgres/PostgREST codes meaning "the migration has not been applied yet" —
 * the ONLY case where proceeding without a limit is correct. Same list and
 * same reasoning as lib/queue.ts's acquireBrandLock.
 */
const MIGRATION_MISSING_CODES = new Set([
  "PGRST202", // PostgREST: function not found in schema cache
  "PGRST205", // PostgREST: table not found in schema cache
  "42883",    // Postgres: undefined_function
  "42P01",    // Postgres: undefined_table
]);

/**
 * Consume one unit of `bucket` for `brandId`.
 *
 * FAILS OPEN, deliberately. A rate limiter that returns 429 because its own
 * storage is briefly unavailable converts a minor infrastructure blip into a
 * total outage for every tenant. The thing being protected here is a budget,
 * not correctness or safety — so an unknown error allows the request and says
 * so via `degraded`, while a genuine over-limit is still refused.
 */
export async function consumeRate(
  brandId: string,
  bucket: RateBucket,
  brand: CapabilityScope = { id: brandId }
): Promise<RateResult> {
  const { limit, windowSeconds } = rateWindowFor(brand, bucket);

  const { data, error } = await db.rpc("consume_rate_limit", {
    p_brand_id: brandId,
    p_bucket: bucket,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  if (error) {
    if (!MIGRATION_MISSING_CODES.has(error.code || "")) {
      // Worth seeing in the log: limiting is silently off until it is fixed.
      console.warn(`[rateLimit] ${bucket} check failed, allowing request: ${error.code} ${error.message}`);
    }
    return { allowed: true, used: 0, limit, resetAt: null, degraded: true };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; used: number; limit_value: number; reset_at: string }
    | undefined;

  if (!row) return { allowed: true, used: 0, limit, resetAt: null, degraded: true };

  return {
    allowed: !!row.allowed,
    used: row.used,
    limit: row.limit_value ?? limit,
    resetAt: row.reset_at ?? null,
    degraded: false,
  };
}

/**
 * Route-level guard: consume a unit, or return the 429 to send back.
 *
 * Returns null when the request may proceed, so a route reads exactly like its
 * existing auth checks:
 *
 *   const limited = await enforceRate(brandId, "ai");
 *   if (limited) return limited;
 */
export async function enforceRate(
  brandId: string,
  bucket: RateBucket
): Promise<NextResponse | null> {
  const result = await consumeRate(brandId, bucket);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: rateLimitMessage(result), retry_at: result.resetAt },
    {
      status: 429,
      headers: {
        // Standard hints so a client can back off intelligently rather than
        // hammering. Seconds, per the HTTP spec.
        "Retry-After": String(
          result.resetAt ? Math.max(1, Math.ceil((Date.parse(result.resetAt) - Date.now()) / 1000)) : 60
        ),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/**
 * Customer-facing wording. Never mentions buckets, windows or limit internals.
 *
 * Phrased as a RELATIVE duration, not a wall-clock time. The first version
 * rendered `resetAt` with toLocaleTimeString on the server, which produced two
 * problems the live verification surfaced: the time was formatted in the
 * SERVER's timezone (meaningless to a customer elsewhere), and "11:00 p.m."
 * already ends in a period, so appending one gave "11:00 p.m..". A duration is
 * timezone-independent and needs no punctuation repair.
 */
export function rateLimitMessage(result: RateResult): string {
  const base = "You've made a lot of requests in a short time.";
  if (!result.resetAt) return `${base} Please try again shortly.`;

  const seconds = Math.max(0, Math.ceil((Date.parse(result.resetAt) - Date.now()) / 1000));
  if (!Number.isFinite(seconds) || seconds <= 0) return `${base} Please try again shortly.`;
  if (seconds < 90) return `${base} Please try again in less than a minute.`;

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${base} Please try again in about ${minutes} minutes.`;

  const hours = Math.round(minutes / 60);
  return `${base} Please try again in about ${hours} hour${hours === 1 ? "" : "s"}.`;
}
