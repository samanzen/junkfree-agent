// Unit tests for lib/auth.ts's pure authorization functions (Sprint 6.5
// Phase 2). This is the entire cross-tenant access-control boundary in this
// app -- every DB call goes through the service-role client (lib/supabase.ts),
// which bypasses RLS, so these functions (not Postgres) are what actually
// keeps one tenant's data from another's.
//
// requireAuth() itself is intentionally NOT tested here -- it calls Supabase
// (db.auth.getUser, db.from("profiles")...) and would need a mocked client,
// a separate, larger effort (see the Sprint 6.5 plan's Non-goals). isAuthError,
// requireAdmin, and requireBrandAccess take an already-resolved AuthContext
// and do pure logic with no I/O -- tested directly here, unmocked.

import { test, expect } from "vitest";
import { NextResponse } from "next/server";
import { isAuthError, requireAdmin, requireBrandAccess, type AuthContext } from "./auth";

function makeAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return { id: "user-1", email: "user@example.com", role: "customer", brandId: "brand-1", ...overrides };
}

test("isAuthError: true for a NextResponse, false for an AuthContext", () => {
  expect(isAuthError(NextResponse.json({ error: "unauthorized" }, { status: 401 }))).toBe(true);
  expect(isAuthError(makeAuth())).toBe(false);
});

test("requireAdmin: allows an admin", () => {
  expect(requireAdmin(makeAuth({ role: "admin" }))).toBeNull();
});

test("requireAdmin: rejects a customer with 403", () => {
  const result = requireAdmin(makeAuth({ role: "customer" }));
  expect(result).not.toBeNull();
  expect(result?.status).toBe(403);
});

test("requireBrandAccess: allows an admin regardless of brandId", () => {
  expect(requireBrandAccess(makeAuth({ role: "admin", brandId: null }), "any-brand")).toBeNull();
  expect(requireBrandAccess(makeAuth({ role: "admin", brandId: "brand-1" }), "brand-2")).toBeNull();
});

test("requireBrandAccess: allows a customer whose brandId matches the requested brand", () => {
  expect(requireBrandAccess(makeAuth({ role: "customer", brandId: "brand-1" }), "brand-1")).toBeNull();
});

test("requireBrandAccess: rejects a customer whose brandId does not match, with 403 (the core cross-tenant check)", () => {
  const result = requireBrandAccess(makeAuth({ role: "customer", brandId: "brand-1" }), "brand-2");
  expect(result).not.toBeNull();
  expect(result?.status).toBe(403);
});

test("requireBrandAccess: rejects a customer with no brand assigned, with 403", () => {
  const result = requireBrandAccess(makeAuth({ role: "customer", brandId: null }), "brand-1");
  expect(result).not.toBeNull();
  expect(result?.status).toBe(403);
});

test("requireBrandAccess: rejects a missing requested brandId with 400", () => {
  for (const missing of [null, undefined, ""]) {
    const result = requireBrandAccess(makeAuth(), missing);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(400);
  }
});
