import { expect, test } from "vitest";
import fs from "fs";
import { defaultOwnerPlaybook, mergeOwnerCorrection, ownerPlaybookBlock } from "./owner";

const brand = {
  name: "Junk Free",
  services: "junk removal",
  service_area: "Toronto",
  voice: "direct",
  intent_notes: "free",
  edge: "same-day",
  owner_playbook: null as string | null,
};

test("default playbook prefers hire-ready searches and forbids invented prices", () => {
  const text = defaultOwnerPlaybook(brand);
  expect(text).toMatch(/hire/i);
  expect(text).toMatch(/junk removal/);
  expect(text).toMatch(/Toronto/);
  expect(text).toMatch(/Never invent prices/i);
  expect(text).toMatch(/free/);
});

test("stored playbook wins over the default", () => {
  const block = ownerPlaybookBlock({ ...brand, owner_playbook: "Only write about bin rentals." });
  expect(block).toContain("Only write about bin rentals.");
  expect(block).not.toContain("same-day");
});

test("owner corrections append and do not duplicate", () => {
  const first = mergeOwnerCorrection(null, "Stop proposing cost pages.", brand);
  const second = mergeOwnerCorrection(first, "Stop proposing cost pages.", brand);
  const hits = second.split("\n").filter((l) => l.includes("Stop proposing cost pages."));
  expect(hits).toHaveLength(1);
  expect(second).toMatch(/Owner correction/);
});
