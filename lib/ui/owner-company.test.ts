import { expect, test } from "vitest";
import fs from "fs";

test("Feature 01 Manager is wired into the live planner", () => {
  const steps = fs.readFileSync("lib/steps.ts", "utf8");
  expect(steps).toMatch(/runSeoManager/);
  expect(steps).toMatch(/runQaCritic/);
  expect(steps).toMatch(/decidePolicy/);
  expect(steps).toMatch(/checkPublishedPage/);
  expect(steps).toMatch(/reportOutcomes/);
  expect(steps).toMatch(/ownerPlaybook|OWNER PLAYBOOK|checkPublishedPage/);
});

test("owner playbook is injected into every agent brand block", () => {
  const brands = fs.readFileSync("lib/brands.ts", "utf8");
  expect(brands).toMatch(/ownerPlaybookBlock/);
  expect(brands).toMatch(/owner_playbook/);
});

test("declines teach the Manager, not only that draft", () => {
  const approve = fs.readFileSync("app/api/drafts/[id]/approve/route.ts", "utf8");
  expect(approve).toMatch(/recordOwnerTeaching/);
  const revise = fs.readFileSync("app/api/drafts/[id]/revise/route.ts", "utf8");
  expect(revise).toMatch(/recordOwnerTeaching/);
});

test("owner-company migration is brand-scoped and service-role only", () => {
  const sql = fs.readFileSync("supabase/019_owner_company.sql", "utf8");
  expect(sql).toMatch(/owner_playbook/);
  expect(sql).toMatch(/publish_checks/);
  expect(sql).toMatch(/outcome_reports/);
  expect(sql).toMatch(/revoke all on table publish_checks from anon, authenticated/);
});
