// Application-layer encryption for secrets that must never be stored in
// plaintext (Sprint 6.1: per-brand integration credentials). AES-256-GCM via
// Node's built-in `crypto` -- no new dependency.
//
// The key is read lazily from INTEGRATION_ENCRYPTION_KEY (same pattern as
// lib/supabase.ts's lazy client init) so a missing env var never breaks
// `next build` or any unrelated route -- it only throws when something
// actually tries to encrypt/decrypt.
//
// Generate a key with: openssl rand -base64 32

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // standard GCM nonce size

function loadKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be set to encrypt or decrypt integration credentials.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `INTEGRATION_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). Generate one with: openssl rand -base64 32`
    );
  }
  return key;
}

// Encrypts a plaintext string. Returns "iv:authTag:ciphertext", each segment
// base64 -- safe to store directly in a text column. A fresh random IV is
// used every call, so encrypting the same plaintext twice never produces the
// same ciphertext.
export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

// Decrypts a value produced by encryptSecret(). Throws if the key is wrong
// or the ciphertext/authTag has been tampered with (GCM's built-in
// integrity check) -- callers should not treat a thrown error here as
// "empty credentials", only as "credentials could not be verified".
export function decryptSecret(stored: string): string {
  const key = loadKey();
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted value: expected iv:authTag:ciphertext.");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

// Encrypts a JSON-serializable credential bag (the shape every provider's
// tokens/keys will take) in one step.
export function encryptCredentials(credentials: Record<string, string>): string {
  return encryptSecret(JSON.stringify(credentials));
}

// Inverse of encryptCredentials().
export function decryptCredentials(stored: string): Record<string, string> {
  return JSON.parse(decryptSecret(stored)) as Record<string, string>;
}
