import { describe, expect, test, beforeEach } from "vitest";
import {
  clientKeyFrom,
  anonLimitMessage,
  ANON_AUDIT_LIMIT,
  __resetAnonAuditMemory,
} from "./limit";

beforeEach(() => __resetAnonAuditMemory());

describe("clientKeyFrom", () => {
  test("never returns the raw IP", () => {
    const key = clientKeyFrom(new Headers({ "x-forwarded-for": "203.0.113.9" }));
    expect(key).not.toContain("203.0.113.9");
    expect(key).toMatch(/^[a-f0-9]{48}$/);
  });

  test("reads the last forwarded entry so a spoofed prefix cannot mint buckets", () => {
    // Vercel appends the real peer address last; a caller-supplied prefix must
    // not change which bucket they land in.
    const spoofed = clientKeyFrom(
      new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.9" }),
    );
    const plain = clientKeyFrom(new Headers({ "x-forwarded-for": "203.0.113.9" }));
    expect(spoofed).toBe(plain);
  });

  test("distinct clients get distinct keys", () => {
    const a = clientKeyFrom(new Headers({ "x-forwarded-for": "203.0.113.1" }));
    const b = clientKeyFrom(new Headers({ "x-forwarded-for": "203.0.113.2" }));
    expect(a).not.toBe(b);
  });

  test("falls back to a stable key when no address header is present", () => {
    const a = clientKeyFrom(new Headers());
    const b = clientKeyFrom(new Headers());
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{48}$/);
  });
});

describe("anonLimitMessage", () => {
  test("points at the free account rather than dead-ending", () => {
    const msg = anonLimitMessage({
      allowed: false,
      used: ANON_AUDIT_LIMIT + 1,
      limit: ANON_AUDIT_LIMIT,
      resetAt: new Date(Date.now() + 300_000).toISOString(),
      degraded: false,
    });
    expect(msg).toMatch(/free account/i);
    expect(msg).toMatch(/\d+ minute/);
    // Never leak internals to a visitor.
    expect(msg).not.toMatch(/bucket|window|rpc|postgres/i);
  });

  test("stays sensible when no reset time is known", () => {
    const msg = anonLimitMessage({
      allowed: false,
      used: 9,
      limit: ANON_AUDIT_LIMIT,
      resetAt: null,
      degraded: true,
    });
    expect(msg).toMatch(/try again shortly/i);
  });
});
