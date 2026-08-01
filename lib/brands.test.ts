// Unit tests for lib/brands.ts's isLocalBusiness (Sprint 6.5 Phase 3).
// This single function is the switch behind Sprint 6.2 Phase 3's job-queue
// gating (whether GBP/citations jobs are enqueued at all) and the Sprint
// 6.2/6.3 dashboard/portal UI's tab and stat-tile visibility -- cheap to
// test, high-value given how many downstream decisions key off it.

import { test, expect } from "vitest";
import { isLocalBusiness, type Brand, type BusinessModel } from "./brands";

function makeBrand(business_model: BusinessModel): Brand {
  return {
    id: "brand-1",
    slug: "test-brand",
    name: "Test Brand",
    site_url: "https://example.com",
    gsc_property: null,
    gbp_location_id: null,
    service_area: null,
    services: null,
    edge: null,
    voice: null,
    competitors: null,
    intent_notes: null,
    auto_publish_meta: false,
    active: true,
    owner_email: null,
    business_model,
    dataforseo_location_code: null,
    dataforseo_language_code: "en",
  };
}

test("isLocalBusiness: true for local_service", () => {
  expect(isLocalBusiness(makeBrand("local_service"))).toBe(true);
});

test("isLocalBusiness: false for every non-local business model", () => {
  const nonLocal: BusinessModel[] = ["ecommerce", "saas", "national_brand", "content_publisher"];
  for (const model of nonLocal) {
    expect(isLocalBusiness(makeBrand(model))).toBe(false);
  }
});
