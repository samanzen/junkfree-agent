// Orphaned job recovery.
//
// The incident: a serverless invocation was killed mid-job, so finishJob()
// never ran and the row was stranded at "running" with no process behind it.
// Reclamation happened only at the start of a cron tick, and the crons run
// daily — so a job orphaned three minutes INTO a tick waited for the next one.
// Measured: pomobuild's content job sat "running" 16+ hours, inside a 21-hour
// gap between sweeps.
//
// Three defects, three fixes, guarded here.

import fs from "fs";
import { test, expect } from "vitest";
import { FETCH_TIMEOUT_MS } from "../auditor";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

// ── 1. An unresponsive site cannot consume the whole invocation ─────────────
test("every crawl request is bounded by a timeout", () => {
  const src = read("lib/auditor.ts");
  expect(src).toMatch(/signal: AbortSignal\.timeout\(FETCH_TIMEOUT_MS\)/);
  // Both the sitemap fetch and the page fetch must go through it — a single
  // unbounded call is enough to strand a job.
  expect(src).not.toMatch(/await fetch\(/);
  expect((src.match(/crawlFetch\(/g) || []).length).toBeGreaterThanOrEqual(3); // definition + 2 call sites
});

test("the timeout is well inside the function budget", () => {
  // Jobs run with a 60s ceiling. A timeout at or above that would not prevent
  // the invocation being killed first, which is the whole point.
  expect(FETCH_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
  expect(FETCH_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
});

// ── 2. Recovery happens on any drain attempt, not only on a cron tick ──────
test("stale jobs are reclaimed before a new one is claimed", () => {
  const src = read("lib/runner.ts");
  const fn = src.slice(src.indexOf("export async function processOneJob"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  // Order matters: sweeping after claiming would reclaim the job just claimed.
  expect(body.indexOf("clearStale(brandId)")).toBeGreaterThan(-1);
  expect(body.indexOf("clearStale(brandId)")).toBeLessThan(body.indexOf("claimNext(brandId)"));
});

test("the sweep is scoped to one brand", () => {
  // /api/step is reachable by a customer; an unscoped sweep would let one
  // tenant's request touch another tenant's rows.
  expect(read("lib/runner.ts")).toMatch(/await clearStale\(brandId\)/);
});

test("the cron sweep is retained as a backstop", () => {
  // Per-drain recovery shortens the window; it does not replace the global
  // sweep, which still catches brands nobody is actively draining.
  expect(read("app/api/cron/rank-sync/route.ts")).toMatch(/await clearStale\(\)/);
});

// ── 3. Staleness means "running too long", not "enqueued long ago" ─────────
test("stale detection is based on when the job started", () => {
  const src = read("lib/queue.ts");
  expect(src).toMatch(/started_at\.lt\.\$\{cutoff\}/);
  // The old rule would kill a job that had been queued for days and running
  // for seconds.
  expect(src).not.toMatch(/\.lt\("created_at", cutoff\)/);
});

test("rows without started_at still fall back to created_at", () => {
  // started_at is written best-effort (see claimNext), so rows predating it
  // must remain reclaimable rather than becoming immortal.
  expect(read("lib/queue.ts")).toMatch(
    /and\(started_at\.is\.null,created_at\.lt\.\$\{cutoff\}\)/
  );
});

test("the reclaim window is still one hour", () => {
  // Changing the predicate must not quietly change the threshold.
  expect(read("lib/queue.ts")).toMatch(/Date\.now\(\) - 3600_000/);
});

// ── no regression in the surrounding contract ──────────────────────────────
test("claiming is still atomic", () => {
  // The conditional UPDATE is what stops two callers winning the same job;
  // adding a sweep in front must not disturb it.
  const src = read("lib/queue.ts");
  expect(src).toMatch(/\.update\(\{ status: "running" \}\)[\s\S]{0,80}\.eq\("status", "queued"\)/);
});

test("a reclaimed job is marked failed, not silently re-queued", () => {
  // Re-queueing would loop forever on a job that reliably kills its host.
  const src = read("lib/queue.ts");
  expect(src).toMatch(/\.update\(\{ status: "failed" \}\)/);
  expect(src).toMatch(/stale: reclaimed after 1h timeout/);
});
