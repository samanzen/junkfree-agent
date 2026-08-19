import fs from "fs";
import { test, expect } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

test("the admin Intelligence page has an AI visibility section", () => {
  const src = read("app/dashboard/intelligence/IntelligencePage.tsx");
  expect(src).toMatch(/key: "ai-visibility"/);
  expect(src).toMatch(/AiVisibilityPanel/);
  expect(src).not.toMatch(/from "recharts"/);
});

test("the admin report reads the intelligence API and does not invent a second scoring rule", () => {
  const src = read("app/dashboard/intelligence/AiVisibilityPanel.tsx");
  expect(src).toContain("/api/intelligence/ai-visibility");
  expect(src).toContain("namedIn(");
  expect(src).not.toMatch(/mentioned\s*\/\s*scorable/);
});

test("only an admin can spend a sweep from the report", () => {
  const panel = read("app/dashboard/intelligence/AiVisibilityPanel.tsx");
  expect(panel).toMatch(/isAdmin &&/);
  expect(panel).toContain('"/api/cron/ai-visibility"');
  expect(panel).toMatch(/method:\s*"POST"/);

  const dash = read("app/dashboard/page.tsx");
  expect(dash).toMatch(/isAdmin=\{role === "admin"\}/);
});

test("the customer portal has the same report and no sweep trigger", () => {
  const page = read("app/portal/intelligence/page.tsx");
  expect(page).toMatch(/key: "ai-visibility"/);
  expect(page).toMatch(/AiVisibilityTab/);

  const tab = read("app/portal/intelligence/_tabs/AiVisibilityTab.tsx");
  expect(tab).toContain("/api/intelligence/ai-visibility");
  expect(tab).toContain('emptyBody(');
  expect(tab).toContain('"customer"');
  expect(tab).not.toContain("/api/cron/ai-visibility");
  expect(tab).not.toMatch(/\bAPI\b/);
  expect(tab).not.toMatch(/migration|supabase\/018|ANTHROPIC_API_KEY/i);
});

test("the mention-rate copy lives in one place", () => {
  const src = read("lib/ai-visibility/display.ts");
  expect(src).toMatch(/Named in \$\{mentioned\} of \$\{scorable\}/);
  expect(read("app/dashboard/intelligence/AiVisibilityPanel.tsx")).toContain('from "@/lib/ai-visibility/display"');
  expect(read("app/portal/intelligence/_tabs/AiVisibilityTab.tsx")).toContain('from "@/lib/ai-visibility/display"');
});
