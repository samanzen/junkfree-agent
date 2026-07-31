// Unit tests for lib/crypto.ts. Run with: npm test
// Uses Node's built-in test runner (node:test) -- no new dependency.

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";

// Use a throwaway key for the test process only; production keys come from
// INTEGRATION_ENCRYPTION_KEY and are never generated at runtime like this.
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const { encryptSecret, decryptSecret, encryptCredentials, decryptCredentials } = await import("./crypto.ts");

test("encryptSecret/decryptSecret round-trips a plaintext string", () => {
  const plaintext = "sk-live-super-secret-token-value";
  const encrypted = encryptSecret(plaintext);
  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptSecret(encrypted), plaintext);
});

test("encryptSecret produces a different ciphertext each call (random IV)", () => {
  const plaintext = "same-input-both-times";
  const a = encryptSecret(plaintext);
  const b = encryptSecret(plaintext);
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), plaintext);
  assert.equal(decryptSecret(b), plaintext);
});

test("decryptSecret throws on tampered ciphertext (GCM auth tag check)", () => {
  const encrypted = encryptSecret("do-not-tamper-with-me");
  const [iv, authTag, ciphertext] = encrypted.split(":");
  const tamperedByte = Buffer.from(ciphertext, "base64");
  tamperedByte[0] = tamperedByte[0] ^ 0xff;
  const tampered = [iv, authTag, tamperedByte.toString("base64")].join(":");
  assert.throws(() => decryptSecret(tampered));
});

test("decryptSecret throws on malformed input", () => {
  assert.throws(() => decryptSecret("not-a-valid-payload"));
});

test("encryptCredentials/decryptCredentials round-trips a credential object", () => {
  const creds = { access_token: "abc123", refresh_token: "xyz789", expires_at: "2026-01-01" };
  const encrypted = encryptCredentials(creds);
  const decrypted = decryptCredentials(encrypted);
  assert.deepEqual(decrypted, creds);
});

test("encryptSecret throws a clear error when the key is missing", async () => {
  const saved = process.env.INTEGRATION_ENCRYPTION_KEY;
  delete process.env.INTEGRATION_ENCRYPTION_KEY;
  try {
    assert.throws(() => encryptSecret("anything"), /INTEGRATION_ENCRYPTION_KEY/);
  } finally {
    process.env.INTEGRATION_ENCRYPTION_KEY = saved;
  }
});
