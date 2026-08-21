import { expect, test } from "vitest";
import { wordpressAdapter } from "./adapters/wordpress";
import { shopifyAdapter } from "./adapters/shopify";
import { webhookAdapter } from "./adapters/webhook";
import {
  capabilityForTaskType,
  capabilityMapFor,
  executionGrade,
  isOperationCertified,
  parseCapabilityMap,
} from "./site-capabilities";

test("WordPress claims pages unverified and titles unsupported", () => {
  const map = capabilityMapFor(wordpressAdapter);
  expect(map.upsert_page?.state).toBe("supported_unverified");
  expect(map.upsert_page?.writer).toBe("wordpress");
  expect(map.update_meta?.state).toBe("unsupported");
  expect(map.update_meta?.reason).toMatch(/titles and descriptions/i);
  expect(isOperationCertified(map, "upsert_page")).toBe(false);
  expect(isOperationCertified(map, "update_meta")).toBe(false);
});

test("Shopify matches WordPress on claimed operations", () => {
  const map = capabilityMapFor(shopifyAdapter);
  expect(map.upsert_page?.state).toBe("supported_unverified");
  expect(map.update_meta?.state).toBe("unsupported");
  expect(isOperationCertified(map, "upsert_page")).toBe(false);
});

test("a custom website claims pages unverified and titles unsupported", () => {
  const map = capabilityMapFor(webhookAdapter);
  expect(map.upsert_page?.state).toBe("supported_unverified");
  expect(map.update_meta?.state).toBe("unsupported");
  expect(map.update_meta?.reason).toMatch(/new pages/i);
  expect(isOperationCertified(map, "update_meta")).toBe(false);
});

test("execution grade is none when disconnected", () => {
  expect(executionGrade(capabilityMapFor(wordpressAdapter), false)).toBe("none");
});

test("a reachable unverified writer is transport, never full", () => {
  expect(executionGrade(capabilityMapFor(wordpressAdapter), true)).toBe("transport");
  expect(executionGrade(capabilityMapFor(webhookAdapter), true)).toBe("transport");
  expect(executionGrade({}, true)).toBe("transport");
});

test("partial and full grades exist for later certification without shipping it", () => {
  const partial = parseCapabilityMap({
    upsert_page: {
      state: "certified",
      writer: "webhook",
      reason: "Working",
      certified_at: "2026-01-01T00:00:00Z",
    },
    update_meta: {
      state: "supported_unverified",
      writer: "webhook",
      reason: "Needs proof",
      certified_at: null,
    },
  });
  expect(executionGrade(partial, true)).toBe("partial");
  expect(isOperationCertified(partial, "upsert_page")).toBe(true);
  expect(isOperationCertified(partial, "update_meta")).toBe(false);

  const full = parseCapabilityMap({
    upsert_page: { state: "certified", writer: "webhook", reason: "Working", certified_at: "x" },
    update_meta: { state: "certified", writer: "webhook", reason: "Working", certified_at: "x" },
  });
  expect(executionGrade(full, true)).toBe("full");
});

test("unsupported operations do not block a full grade", () => {
  const wpCertifiedPages = parseCapabilityMap({
    upsert_page: { state: "certified", writer: "wordpress", reason: "Working", certified_at: "x" },
    update_meta: { state: "unsupported", writer: "wordpress", reason: "Not supported", certified_at: null },
  });
  expect(executionGrade(wpCertifiedPages, true)).toBe("full");
});

test("task types map to writer operations without inventing writes", () => {
  expect(capabilityForTaskType("new_page")).toBe("upsert_page");
  expect(capabilityForTaskType("new_blog")).toBe("upsert_page");
  expect(capabilityForTaskType("geo_answers")).toBe("upsert_page");
  expect(capabilityForTaskType("fix_meta")).toBe("update_meta");
  expect(capabilityForTaskType("technical_fix")).toBe("update_meta");
  expect(capabilityForTaskType("improve_content")).toBeNull();
  expect(capabilityForTaskType("research")).toBeNull();
});

test("malformed stored json does not throw and is not certified", () => {
  expect(parseCapabilityMap(null)).toEqual({});
  expect(parseCapabilityMap("wordpress")).toEqual({});
  expect(isOperationCertified(undefined, "upsert_page")).toBe(false);
});

test("parser keeps last_execution_id and fail_count", () => {
  const map = parseCapabilityMap({
    upsert_page: {
      state: "certified",
      writer: "wordpress",
      reason: "Working",
      certified_at: "x",
      last_execution_id: "ex1",
      fail_count: 2,
    },
  });
  expect(map.upsert_page?.last_execution_id).toBe("ex1");
  expect(map.upsert_page?.fail_count).toBe(2);
});
