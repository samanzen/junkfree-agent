import fs from "fs";
import { test, expect } from "vitest";

const sql = fs.readFileSync(`${process.cwd()}/supabase/018_ai_visibility.sql`, "utf8");

test("a half-applied prompts table gets the weight column before the index that needs it", () => {
  const addWeight = sql.indexOf("add column if not exists weight int not null default 100");
  const indexOnWeight = sql.indexOf("on ai_visibility_prompts (brand_id, active, weight desc)");
  expect(addWeight).toBeGreaterThan(0);
  expect(indexOnWeight).toBeGreaterThan(addWeight);
});

test("the migration still creates every table the store talks to", () => {
  for (const t of [
    "ai_visibility_locales",
    "ai_visibility_prompts",
    "ai_visibility_runs",
    "ai_visibility_checks",
    "ai_visibility_citations",
  ]) {
    expect(sql).toContain(`create table if not exists ${t}`);
  }
});
