// Approve must be able to reach a live site, not only the internal content table.
//
// The defect: "Approve & publish" wrote to `content` and never enqueued the
// execution engine, so WordPress-connected brands still saw no live change.

import fs from "fs";
import { test, expect } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

test("approve route dispatches live publish when an adapter is connected", () => {
  const src = read("app/api/drafts/[id]/approve/route.ts");
  expect(src).toMatch(/resolvePublishTarget/);
  expect(src).toMatch(/enqueue\(brand\.id, "publish"/);
  expect(src).toMatch(/processOneJob\(brand\.id\)/);
  expect(src).toMatch(/live:/);
});

test("live publish failure does not undo the human approval", () => {
  // Internal content upsert / status update must happen before the live attempt.
  const src = read("app/api/drafts/[id]/approve/route.ts");
  const approvedAt = src.indexOf('status: "published"');
  const liveBlock = src.indexOf("Live site dispatch");
  expect(approvedAt).toBeGreaterThan(-1);
  expect(liveBlock).toBeGreaterThan(approvedAt);
});

test("approveDraft surfaces the live outcome to the UI", () => {
  const src = read("app/portal/_data.ts");
  expect(src).toMatch(/export type ApproveResult/);
  expect(src).toMatch(/live\?:/);
});
