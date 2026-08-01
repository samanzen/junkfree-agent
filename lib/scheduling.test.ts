// Unit tests for lib/scheduling.ts's pure ordering logic (Sprint 6.5 Phase 4).
// The DB-calling functions (orderByLastCompletedRun, orderByLastCompletedJob,
// lastCompletedRunMap) are intentionally NOT unit-tested here -- same
// rationale as lib/auth.ts's requireAuth (would need a mocked Supabase
// client, a separate effort) -- but the pure logic they delegate to,
// sortByLastRun and latestPerBrand, is tested directly.

import { test, expect } from "vitest";
import { sortByLastRun, latestPerBrand } from "./scheduling";
import type { Brand } from "./brands";

function makeBrand(id: string): Brand {
  return {
    id, slug: id, name: id, site_url: "https://example.com",
    gsc_property: null, gbp_location_id: null, service_area: null, services: null,
    edge: null, voice: null, competitors: null, intent_notes: null,
    auto_publish_meta: false, active: true, owner_email: null,
    business_model: "local_service", dataforseo_location_code: null, dataforseo_language_code: "en",
  };
}

test("latestPerBrand: picks the max finished_at per brand_id from a mixed row list", () => {
  const map = latestPerBrand([
    { brand_id: "a", finished_at: "2026-01-01T00:00:00Z" },
    { brand_id: "a", finished_at: "2026-01-03T00:00:00Z" }, // later -- should win
    { brand_id: "a", finished_at: "2026-01-02T00:00:00Z" },
    { brand_id: "b", finished_at: "2026-01-05T00:00:00Z" },
  ]);
  expect(map.get("a")).toBe("2026-01-03T00:00:00Z");
  expect(map.get("b")).toBe("2026-01-05T00:00:00Z");
  expect(map.has("c")).toBe(false);
});

test("latestPerBrand: empty input produces an empty map", () => {
  expect(latestPerBrand([]).size).toBe(0);
});

test("sortByLastRun: a brand with no entry in the map sorts first (never-run / freshly onboarded)", () => {
  const brands = [makeBrand("has-run"), makeBrand("never-run")];
  const lastRun = new Map([["has-run", "2026-01-01T00:00:00Z"]]);
  const ordered = sortByLastRun(brands, lastRun);
  expect(ordered.map((b) => b.id)).toEqual(["never-run", "has-run"]);
});

test("sortByLastRun: otherwise sorts oldest finished_at first", () => {
  const brands = [makeBrand("newest"), makeBrand("oldest"), makeBrand("middle")];
  const lastRun = new Map([
    ["newest", "2026-01-03T00:00:00Z"],
    ["oldest", "2026-01-01T00:00:00Z"],
    ["middle", "2026-01-02T00:00:00Z"],
  ]);
  const ordered = sortByLastRun(brands, lastRun);
  expect(ordered.map((b) => b.id)).toEqual(["oldest", "middle", "newest"]);
});

test("sortByLastRun: multiple never-run brands keep their relative order (stable sort)", () => {
  const brands = [makeBrand("x"), makeBrand("y"), makeBrand("z")];
  const ordered = sortByLastRun(brands, new Map());
  expect(ordered.map((b) => b.id)).toEqual(["x", "y", "z"]);
});
