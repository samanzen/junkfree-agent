// Per-tenant geo and language targeting (Migration 007).
//
// Before the migration, brands.dataforseo_location_code and
// dataforseo_language_code did not exist, so geoOf() resolved to undefined for
// every brand and EVERY tenant was silently forced to Canada/English — which
// made the platform unable to serve a customer in any other market.
//
// The application code was already correct; only the columns were missing.
// These tests pin the contract so it cannot regress: the codes must reach the
// outbound request, and a brand without them must still fall back safely.
//
// Hermetic by design — fetch is stubbed, so no network call and no spend.

import { test, expect, vi, afterEach } from "vitest";
import {
  geoOf,
  keywordVolumes,
  keywordIdeas,
  rankedKeywords,
  serpTop,
} from "../dataforseo";

process.env.DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN || "test-login";
process.env.DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD || "test-password";

/** Capture outbound DataForSEO request bodies without sending them. */
function captureBodies() {
  const seen: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body))[0]);
    return new Response(JSON.stringify({ tasks: [{ result: [] }] }), { status: 200 });
  });
  return seen;
}

afterEach(() => vi.unstubAllGlobals());

// ── geoOf reads the brand ───────────────────────────────────────────────────
test("geoOf returns the brand's own codes", () => {
  expect(geoOf({ dataforseo_location_code: 2826, dataforseo_language_code: "en-GB" }))
    .toEqual({ locationCode: 2826, languageCode: "en-GB" });
});

test("a brand with no codes yields undefined, not a guessed default", () => {
  // undefined lets the CALLER apply its documented fallback. Returning a
  // hardcoded country here would make the fallback invisible.
  expect(geoOf({ dataforseo_location_code: null, dataforseo_language_code: null }))
    .toEqual({ locationCode: undefined, languageCode: undefined });
  expect(geoOf({})).toEqual({ locationCode: undefined, languageCode: undefined });
});

// ── the codes actually reach DataForSEO ─────────────────────────────────────
test("per-tenant codes reach every geo-dependent request", async () => {
  const seen = captureBodies();
  const uk = { locationCode: 2826, languageCode: "en-GB" };

  await keywordVolumes(["roof repair"], uk);
  await keywordIdeas("roof repair", uk);
  await rankedKeywords("example.com", uk);
  await serpTop("roof repair", uk);

  expect(seen).toHaveLength(4);
  for (const body of seen) {
    expect(body.location_code).toBe(2826);
    expect(body.language_code).toBe("en-GB");
  }
});

test("two tenants with different markets produce different requests", async () => {
  // The whole point of the migration: one platform, many markets.
  const seen = captureBodies();
  await keywordVolumes(["a"], geoOf({ dataforseo_location_code: 2124, dataforseo_language_code: "en" }));
  await keywordVolumes(["a"], geoOf({ dataforseo_location_code: 2840, dataforseo_language_code: "es" }));

  expect(seen[0].location_code).toBe(2124);
  expect(seen[0].language_code).toBe("en");
  expect(seen[1].location_code).toBe(2840);
  expect(seen[1].language_code).toBe("es");
});

// ── existing customers keep working ─────────────────────────────────────────
test("omitting geo falls back to the platform default, unchanged", async () => {
  // Guards existing Canadian customers: a call site that never passes geo must
  // behave exactly as it did before the migration.
  const seen = captureBodies();
  await keywordVolumes(["roof repair"]);
  expect(seen[0].location_code).toBe(2124);
  expect(seen[0].language_code).toBe("en");
});

test("a partially configured brand falls back only for the missing half", async () => {
  const seen = captureBodies();
  await keywordVolumes(["a"], geoOf({ dataforseo_location_code: 2840, dataforseo_language_code: null }));
  expect(seen[0].location_code).toBe(2840); // the brand's own
  expect(seen[0].language_code).toBe("en");  // the default
});

// ── the Brand type exposes the columns ──────────────────────────────────────
test("the Brand type carries the geo columns", async () => {
  const fs = await import("fs");
  const src = fs.readFileSync(`${process.cwd()}/lib/brands.ts`, "utf8");
  for (const col of ["business_model", "dataforseo_location_code", "dataforseo_language_code"]) {
    expect(src).toContain(col);
  }
});
