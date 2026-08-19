// Tenant-aware rate limiting.
//
// Before this, no route had inbound throttling — only /api/run had a cooldown.
// Every expensive endpoint (Claude, DataForSEO, job dispatch) was unmetered
// per tenant, so one customer, or one runaway loop in one customer's browser,
// could exhaust the platform's AI budget for everybody.

import fs from "fs";
import { test, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("../supabase", () => ({ db: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { consumeRate, enforceRate, rateLimitMessage, rateWindowFor } = await import("../rateLimit");

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

const ok = (used: number, limit: number) => ({
  data: [{ allowed: used <= limit, used, limit_value: limit, reset_at: "2030-01-01T12:00:00Z" }],
  error: null,
});

beforeEach(() => rpc.mockReset());

// ── the counter is per tenant AND per bucket ───────────────────────────────
test("the tenant and the bucket are both part of the key", async () => {
  rpc.mockResolvedValue(ok(1, 60));
  await consumeRate("brand-a", "ai");
  await consumeRate("brand-b", "ai");
  await consumeRate("brand-a", "external");

  const calls = rpc.mock.calls.map((c) => c[1]);
  expect(calls[0].p_brand_id).toBe("brand-a");
  expect(calls[1].p_brand_id).toBe("brand-b");
  expect(calls[0].p_bucket).toBe("ai");
  expect(calls[2].p_bucket).toBe("external");
  // Distinct keys => independent budgets. One tenant cannot spend another's.
  const keys = calls.map((c) => `${c.p_brand_id}:${c.p_bucket}`);
  expect(new Set(keys).size).toBe(3);
});

test("each bucket carries its own limit and window", async () => {
  rpc.mockResolvedValue(ok(1, 60));
  await consumeRate("brand-a", "ai");
  await consumeRate("brand-a", "external");
  await consumeRate("brand-a", "dispatch");
  const limits = rpc.mock.calls.map((c) => c[1].p_limit);
  expect(new Set(limits).size).toBeGreaterThan(1);
  for (const c of rpc.mock.calls) expect(c[1].p_window_seconds).toBeGreaterThan(0);
});

// ── enforcement ────────────────────────────────────────────────────────────
test("a request under the limit is allowed", async () => {
  rpc.mockResolvedValue(ok(5, 60));
  const r = await consumeRate("brand-a", "ai");
  expect(r.allowed).toBe(true);
  expect(await enforceRate("brand-a", "ai")).toBeNull();
});

test("a request over the limit is refused with 429", async () => {
  rpc.mockResolvedValue(ok(61, 60));
  const res = await enforceRate("brand-a", "ai");
  expect(res).not.toBeNull();
  expect(res!.status).toBe(429);
  expect(res!.headers.get("Retry-After")).toBeTruthy();
  expect(res!.headers.get("X-RateLimit-Limit")).toBe("60");
  const body = await res!.json();
  expect(body.error).toMatch(/try again/i);
});

test("the boundary is inclusive — the limit-th request still succeeds", async () => {
  rpc.mockResolvedValue(ok(60, 60));
  expect((await consumeRate("brand-a", "ai")).allowed).toBe(true);
});

// ── failure behaviour ──────────────────────────────────────────────────────
test("an unapplied migration allows the request rather than blocking everyone", async () => {
  // Deploying the code before the SQL must be harmless — same convention as
  // acquireBrandLock in lib/queue.ts.
  for (const code of ["PGRST202", "PGRST205", "42883", "42P01"]) {
    rpc.mockResolvedValue({ data: null, error: { code, message: "not found" } });
    const r = await consumeRate("brand-a", "ai");
    expect(r.allowed, `${code} should fail open`).toBe(true);
    expect(r.degraded).toBe(true);
  }
});

test("an unexpected storage error fails OPEN, and says so", async () => {
  // A limiter that 429s because its own storage blipped turns a minor
  // infrastructure fault into a total outage for every tenant. The thing
  // protected here is a budget, not correctness.
  rpc.mockResolvedValue({ data: null, error: { code: "57014", message: "statement timeout" } });
  const r = await consumeRate("brand-a", "ai");
  expect(r.allowed).toBe(true);
  expect(r.degraded).toBe(true);
});

test("an empty result fails open too", async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  expect((await consumeRate("brand-a", "ai")).allowed).toBe(true);
});

// ── the message a customer sees ────────────────────────────────────────────
test("the refusal message exposes no internals", async () => {
  const resetAt = new Date(Date.now() + 45 * 60_000).toISOString();
  const msg = rateLimitMessage({ allowed: false, used: 61, limit: 60, resetAt, degraded: false });
  for (const term of ["bucket", "quota", "rate_limit", "window", "RPC", "postgres"]) {
    expect(msg.toLowerCase()).not.toContain(term.toLowerCase());
  }
  expect(msg).toMatch(/try again/i);
});

test("the wait is expressed as a duration, not a wall-clock time", () => {
  // A server-rendered clock time is in the SERVER's timezone and means nothing
  // to a customer elsewhere. It also produced "11:00 p.m.." — the locale
  // format already ends in a period.
  const msg = rateLimitMessage({
    allowed: false, used: 61, limit: 60,
    resetAt: new Date(Date.now() + 45 * 60_000).toISOString(), degraded: false,
  });
  expect(msg).toMatch(/in about 45 minutes\.$/);
  expect(msg).not.toMatch(/\.\./);
  expect(msg).not.toMatch(/[ap]\.?m\.?/i);
});

test("the wait reads correctly at every scale", () => {
  const at = (s: number) => rateLimitMessage({
    allowed: false, used: 1, limit: 1,
    resetAt: new Date(Date.now() + s * 1000).toISOString(), degraded: false,
  });
  expect(at(30)).toMatch(/less than a minute/);
  expect(at(600)).toMatch(/about 10 minutes/);
  expect(at(3600)).toMatch(/about 1 hour\./);   // singular
  expect(at(7200)).toMatch(/about 2 hours\./);  // plural
  // No reset time, or one already passed, must not produce "NaN" or "-3".
  expect(rateLimitMessage({ allowed: false, used: 1, limit: 1, resetAt: null, degraded: false })).toMatch(/shortly\.$/);
  expect(at(-10)).toMatch(/shortly\.$/);
});

// ── wiring ─────────────────────────────────────────────────────────────────
const WIRED: Record<string, string> = {
  "app/api/drafts/[id]/revise/route.ts": "ai",
  "app/api/intelligence/exec-summary/route.ts": "ai",
  "app/api/intelligence/recommendations/route.ts": "ai",
  "app/api/portal/assistant/route.ts": "ai",
  "app/api/portal/llms-txt/route.ts": "ai",
  "app/api/intelligence/competitors/[id]/route.ts": "external",
  "app/api/intelligence/competitors/discover/route.ts": "external",
  "app/api/intelligence/competitors/route.ts": "external",
  "app/api/analytics/route.ts": "external",
  "app/api/portal/summary/route.ts": "external",
  "app/api/intelligence/keyword-history/route.ts": "external",
  "app/api/execution/route.ts": "dispatch",
  "app/api/intelligence/action/route.ts": "dispatch",
  "app/api/images/process/route.ts": "dispatch",
  "app/api/step/route.ts": "dispatch",
  "app/api/run/route.ts": "dispatch",
  "app/api/portal/connections/route.ts": "dispatch",
};

test("every expensive route is limited, with the right bucket", () => {
  for (const [file, bucket] of Object.entries(WIRED)) {
    const src = read(file);
    expect(src, `${file} not limited`).toMatch(/enforceRate\(/);
    expect(src, `${file} wrong bucket`).toContain(`"${bucket}")`);
  }
});

test("limiting always runs AFTER authorisation", () => {
  // Otherwise an unauthenticated or cross-tenant caller could burn a real
  // tenant's allowance just by sending requests.
  for (const file of Object.keys(WIRED)) {
    const src = read(file);
    const auth = src.indexOf("requireAuth(req)");
    const brand = src.indexOf("requireBrandAccess(auth");
    const rate = src.indexOf("enforceRate(");
    expect(auth, `${file}: no requireAuth`).toBeGreaterThan(-1);
    expect(brand, `${file}: no requireBrandAccess`).toBeGreaterThan(-1);
    expect(auth, `${file}: rate limit before auth`).toBeLessThan(rate);
    expect(brand, `${file}: rate limit before brand check`).toBeLessThan(rate);
  }
});

test("limits are resolved through the plan seam, not hardcoded at call sites", () => {
  const src = read("lib/rateLimit.ts");
  expect(src).toMatch(/export function rateWindowFor\(/);
  expect(rateWindowFor({ id: "any" }, "ai").limit).toBeGreaterThan(0);
  // No route may state its own number.
  for (const file of Object.keys(WIRED)) {
    expect(read(file)).not.toMatch(/enforceRate\([^)]*,\s*\d+/);
  }
});
