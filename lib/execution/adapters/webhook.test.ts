import { test, expect } from "vitest";
import { signPayload, verifySignature } from "./webhook";

test("verifySignature accepts the header value the adapter actually sends", () => {
  const body = JSON.stringify({ event: "check", brand: "acme" });
  const secret = "a-reasonably-long-signing-secret";
  const header = `sha256=${signPayload(body, secret)}`;
  expect(verifySignature(body, secret, header)).toBe(true);
  expect(verifySignature(body, secret, signPayload(body, secret))).toBe(true);
});

test("verifySignature rejects a tampered body or wrong secret", () => {
  const body = JSON.stringify({ event: "apply" });
  const secret = "a-reasonably-long-signing-secret";
  const header = `sha256=${signPayload(body, secret)}`;
  expect(verifySignature(body + "x", secret, header)).toBe(false);
  expect(verifySignature(body, "other-secret-value-xx", header)).toBe(false);
});
