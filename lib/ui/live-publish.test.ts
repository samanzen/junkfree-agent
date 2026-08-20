// Approve must enqueue a live publish when a last-mile adapter is connected.
// Without this, publish_executions and publish_checks stay empty forever.

import fs from "fs";
import { test, expect } from "vitest";
import { metaChoiceForHumanApprove } from "../execution/queue-approved";
import { toSiteChange } from "../execution/changes";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

test("human Approve of fix_meta sends option 0, matching Autopilot", () => {
  expect(metaChoiceForHumanApprove("fix_meta")).toBe(0);
  expect(metaChoiceForHumanApprove("new_page")).toBeUndefined();
});

test("improve_content still cannot become a live page", () => {
  const r = toSiteChange(
    {
      task_type: "improve_content",
      title: "Improve",
      body: '{"score":1,"checks":[]}',
      target_url: "https://x.test",
      target_keyword: null,
    },
    "Brand"
  );
  expect(r.publishable).toBe(false);
});

test("the approve route queues live publish after the content write", () => {
  const src = read("app/api/drafts/[id]/approve/route.ts");
  expect(src).toMatch(/from "\@\/lib\/execution\/queue-approved"/);
  const afterUpsert = src.slice(src.indexOf('from("content").upsert'));
  expect(afterUpsert).toMatch(/queueLivePublishIfConnected/);
  // Both page upserts and meta-only approvals enqueue; dismiss does not.
  expect((src.match(/queueLivePublishIfConnected\(/g) || []).length).toBe(2);
  expect(src.slice(0, src.indexOf("if (dismiss)")).includes("queueLivePublishIfConnected(")).toBe(false);
  // A queued last-mile job must not mark the draft published before live proof.
  expect(afterUpsert).toMatch(/live\.queued \? "approved" : "published"/);
});

test("execution honesty migration extends brands instead of adding site tables", () => {
  const sql = read("supabase/020_execution_honesty.sql");
  expect(sql).toMatch(/primary_writer/);
  expect(sql).toMatch(/site_capabilities jsonb/);
  expect(sql).not.toMatch(/create table/i);
});

test("source of truth is one jsonb column on brands, not a sites table", () => {
  const sql = read("supabase/021_source_of_truth.sql");
  expect(sql).toMatch(/source_of_truth jsonb/);
  expect(sql).not.toMatch(/create table/i);
});

test("certify is a job kind on the existing queue", () => {
  const queue = read("lib/queue.ts");
  expect(queue).toMatch(/\| "certify"/);
  expect(read("lib/steps.ts")).toMatch(/case "certify"/);
  expect(read("lib/steps.ts")).toMatch(/isOperationAutopilotReady/);
  expect(read("lib/execution/certify.ts")).toMatch(/enqueue\(brand\.id, "certify"/);
});

test("the execution status endpoint distinguishes transport from proven publishing", () => {
  const src = read("app/api/execution/route.ts");
  expect(src).toMatch(/check_is_transport_only: true/);
  expect(src).toMatch(/execution_grade/);
  expect(src).toMatch(/site_capabilities/);
  expect(src).toMatch(/primary_writer/);
});

test("a live-queue failure cannot fail Approve", () => {
  const src = read("lib/execution/queue-approved.ts");
  expect(src).toMatch(/try \{/);
  expect(src).toMatch(/return \{ queued: false \}/);
  expect(src).toMatch(/enqueue\(brand\.id, "publish"/);
});

test("stepPublish fails the job unless the live page shows the change", () => {
  const src = read("lib/steps.ts");
  expect(src).toMatch(/operationCertified/);
  expect(src).toMatch(/attempts: 3/);
  expect(src).toMatch(/live site does not show the change/);
  expect(src).not.toMatch(/safe\(\(\) => checkPublishedPage/);
  const publishFn = src.slice(src.indexOf("export async function stepPublish"));
  const publishedAt = publishFn.indexOf('update({ status: "published" })');
  const verifyAt = publishFn.indexOf("checkPublishedPage");
  expect(verifyAt).toBeGreaterThan(-1);
  expect(publishedAt).toBeGreaterThan(verifyAt);
});
