// Unit tests for lib/crypto.ts. Run with: npm test.
// Migrated to vitest in Sprint 6.5 Phase 1 (same test cases, same
// assertions, syntax adapted from node:test/node:assert) -- Node's built-in
// test runner can't resolve this project's extensionless relative imports
// (e.g. lib/auth.ts's "./supabase") outside Next.js's own bundler, which
// blocks testing anything beyond fully self-contained files like this one.

import { test, expect } from "vitest";
import { randomBytes } from "crypto";
import { encryptSecret, decryptSecret, encryptCredentials, decryptCredentials } from "./crypto";

// Use a throwaway key for the test process only; production keys come from
// INTEGRATION_ENCRYPTION_KEY and are never generated at runtime like this.
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");

test("encryptSecret/decryptSecret round-trips a plaintext string", () => {
  const plaintext = "sk-live-super-secret-token-value";
  const encrypted = encryptSecret(plaintext);
  expect(encrypted).not.toBe(plaintext);
  expect(decryptSecret(encrypted)).toBe(plaintext);
});

test("encryptSecret produces a different ciphertext each call (random IV)", () => {
  const plaintext = "same-input-both-times";
  const a = encryptSecret(plaintext);
  const b = encryptSecret(plaintext);
  expect(a).not.toBe(b);
  expect(decryptSecret(a)).toBe(plaintext);
  expect(decryptSecret(b)).toBe(plaintext);
});

test("decryptSecret throws on tampered ciphertext (GCM auth tag check)", () => {
  const encrypted = encryptSecret("do-not-tamper-with-me");
  const [iv, authTag, ciphertext] = encrypted.split(":");
  const tamperedByte = Buffer.from(ciphertext, "base64");
  tamperedByte[0] = tamperedByte[0] ^ 0xff;
  const tampered = [iv, authTag, tamperedByte.toString("base64")].join(":");
  expect(() => decryptSecret(tampered)).toThrow();
});

test("decryptSecret throws on malformed input", () => {
  expect(() => decryptSecret("not-a-valid-payload")).toThrow();
});

test("encryptCredentials/decryptCredentials round-trips a credential object", () => {
  const creds = { access_token: "abc123", refresh_token: "xyz789", expires_at: "2026-01-01" };
  const encrypted = encryptCredentials(creds);
  const decrypted = decryptCredentials(encrypted);
  expect(decrypted).toEqual(creds);
});

test("encryptSecret throws a clear error when the key is missing", () => {
  const saved = process.env.INTEGRATION_ENCRYPTION_KEY;
  delete process.env.INTEGRATION_ENCRYPTION_KEY;
  try {
    expect(() => encryptSecret("anything")).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
  } finally {
    process.env.INTEGRATION_ENCRYPTION_KEY = saved;
  }
});
