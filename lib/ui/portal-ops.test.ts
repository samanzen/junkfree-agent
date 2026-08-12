// Phase 2 portal operating IA: Approvals inbox, intent-grouped nav,
// command palette, Intelligence URL tabs, and approval badge counts.

import fs from "fs";
import { test, expect } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

test("Approvals route exists and consolidates drafts + review replies", () => {
  expect(fs.existsSync(`${ROOT}/app/portal/approvals/page.tsx`)).toBe(true);
  const src = read("app/portal/approvals/page.tsx");
  expect(src).toMatch(/usePlatformData/);
  expect(src).toMatch(/pending_review/);
  expect(src).toMatch(/approveDraft/);
  expect(src).toMatch(/dismissDraft/);
  expect(src).toMatch(/review_responses/);
  expect(src).toMatch(/ApprovalCard/);
  // Customer language — no job-kind leakage.
  expect(src).not.toMatch(/\b(job_kind|JobKind|orchestrat)/i);
  expect(src).toMatch(/Waiting on you|You're all caught up|Couldn't load your approvals/);
});

test("PortalShell nav is regrouped by intent", () => {
  const nav = read("app/portal/nav.ts");
  for (const label of ["Overview", "Act", "Analyse", "Site", "Manage", "Assistant"]) {
    expect(nav).toContain(`label: "${label}"`);
  }
  expect(nav).toMatch(/href: "\/portal\/approvals"/);
  expect(nav).toMatch(/pin:\s*"footer"/);

  const shell = read("app/portal/PortalShell.tsx");
  expect(shell).toMatch(/NAV_GROUPS/);
  expect(shell).toMatch(/useApprovalCounts/);
  expect(shell).toMatch(/CommandPalette/);
  expect(shell).toMatch(/p-nav-count/);
});

test("BottomNav exposes Approvals with a badge hook", () => {
  const src = read("app/portal/_components/BottomNav.tsx");
  expect(src).toMatch(/\/portal\/approvals/);
  expect(src).toMatch(/approvalCount/);
  expect(src).toMatch(/p-bnav-count/);
});

test("command palette is route-only and keyboard-driven", () => {
  const src = read("app/portal/_components/CommandPalette.tsx");
  expect(src).toMatch(/metaKey|ctrlKey/);
  expect(src).toMatch(/["']k["']/);
  expect(src).toMatch(/useDialog/);
  expect(src).toMatch(/NAV_ROUTES|NAV_GROUPS/);
  expect(src).toMatch(/ArrowDown|ArrowUp/);
  expect(src).toMatch(/Enter/);
  expect(src).toMatch(/router\.push/);
  // v1 is destinations only — no record search.
  expect(src).not.toMatch(/drafts\?|keywords\?|competitors\?/);
  expect(read("app/portal/portalTheme.ts")).toMatch(/\.p-cmd\b/);
});

test("Intelligence tab state lives in ?tab=", () => {
  const src = read("app/portal/intelligence/page.tsx");
  expect(src).toMatch(/searchParams.*get\(["']tab["']\)|get\(["']tab["']\)/);
  expect(src).toMatch(/params\.set\(["']tab["']/);
  expect(src).toMatch(/history\.replaceState|history\.pushState/);
  expect(src).toMatch(/goToTab/);
});

test("useApprovalCounts is a lightweight shared hook", () => {
  const src = read("app/portal/_data.ts");
  expect(src).toMatch(/export function useApprovalCounts/);
  expect(src).toMatch(/\/api\/platform\?brand=/);
  expect(src).toMatch(/pending_review/);
});
