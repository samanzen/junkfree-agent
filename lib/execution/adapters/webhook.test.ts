import { test, expect, vi, afterEach } from "vitest";
import { signPayload, verifySignature, webhookAdapter } from "./webhook";
import { receiverFailureCopy } from "../receiver-failure";
import type { AdapterContext } from "../types";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

test("a public-site 405 is explained, not reported as a status code", () => {
  expect(receiverFailureCopy(405, "")).toMatch(/public website/i);
  expect(receiverFailureCopy(405, "")).not.toMatch(/HTTP|405/);
  expect(receiverFailureCopy(200, "<!doctype html><html>")).toMatch(/public website/i);
});

function ctx(): AdapterContext {
  return {
    brand: { id: "b1", slug: "junkfree", name: "Junk Free", site_url: "https://www.junkfree.ca" } as AdapterContext["brand"],
    credentials: { signingSecret: "a-reasonably-long-signing-secret" },
    config: { endpointUrl: "https://www.junkfree.ca/api/seo-publish" },
  };
}

test("check() maps a static-host 405 to customer copy", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 405, headers: { "Content-Type": "text/html" } }))
  );
  const r = await webhookAdapter.check(ctx());
  expect(r.ok).toBe(false);
  expect(r.detail).toMatch(/public website/i);
  expect(r.detail).not.toMatch(/HTTP|405/);
});
