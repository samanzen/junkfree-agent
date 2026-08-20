import { test, expect } from "vitest";
import { matchesQueueFilter, QUEUE_FILTERS } from "./queue";

test("pending is the default view and hides approved drafts", () => {
  expect(matchesQueueFilter("pending_review", "pending")).toBe(true);
  expect(matchesQueueFilter("approved", "pending")).toBe(false);
  expect(matchesQueueFilter("published", "pending")).toBe(false);
  expect(matchesQueueFilter("dismissed", "pending")).toBe(false);
});

test("approved view only shows accepted items", () => {
  expect(matchesQueueFilter("approved", "approved")).toBe(true);
  expect(matchesQueueFilter("pending_review", "approved")).toBe(false);
});

test("all shows pending and approved, not dismissed", () => {
  expect(matchesQueueFilter("pending_review", "all")).toBe(true);
  expect(matchesQueueFilter("approved", "all")).toBe(true);
  expect(matchesQueueFilter("dismissed", "all")).toBe(false);
});

test("citation live counts as approved, suggested as pending", () => {
  expect(matchesQueueFilter("suggested", "pending", "citation")).toBe(true);
  expect(matchesQueueFilter("live", "pending", "citation")).toBe(false);
  expect(matchesQueueFilter("live", "approved", "citation")).toBe(true);
});

test("the queue filter labels include pending as the default choice", () => {
  expect(QUEUE_FILTERS[0]).toEqual({ value: "pending", label: "Pending review" });
});
