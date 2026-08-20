import { test, expect } from "vitest";
import fs from "fs";
import { codedSiteSnippet, CODED_SITE_SNIPPET, CODED_SITE_SECRET_PLACEHOLDER } from "./receiver-snippet";
import { signPayload, verifySignature } from "./adapters/webhook";

test("the snippet verifies X-Signature-256 the same way the adapter signs", () => {
  expect(CODED_SITE_SNIPPET).toMatch(/x-signature-256/);
  expect(CODED_SITE_SNIPPET).toMatch(/sha256=/);
  expect(CODED_SITE_SNIPPET).toMatch(/createHmac\("sha256"/);

  const secret = "unit-test-secret-value-32chars!!";
  const body = JSON.stringify({ event: "check" });
  const header = `sha256=${signPayload(body, secret)}`;
  expect(verifySignature(body, secret, header)).toBe(true);

  const filled = codedSiteSnippet(secret);
  expect(filled).toContain(secret);
  expect(filled).not.toContain(CODED_SITE_SECRET_PLACEHOLDER);
});

test("an empty secret leaves the placeholder so the customer can still copy the shape", () => {
  expect(codedSiteSnippet("")).toContain(CODED_SITE_SECRET_PLACEHOLDER);
});

test("the junkfree-site receiver example lives in this repo so it can be opened", () => {
  const src = fs.readFileSync("examples/junkfree-site/app/api/seo-publish/route.ts", "utf8");
  expect(src).toMatch(/x-signature-256/);
  expect(src).toMatch(/SEO_PUBLISH_SECRET/);
  expect(src).toMatch(/from\("content"\)\.upsert/);
});
