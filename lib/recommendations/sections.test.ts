import { test, expect } from "vitest";
import {
  isDraftAutopilot,
  isSectionAutopilot,
  readAutopilotMap,
  sectionForTaskType,
  RECOMMENDATION_SECTIONS,
} from "./sections";

test("sectionForTaskType maps draft kinds to tabs", () => {
  expect(sectionForTaskType("new_page")).toBe("pages");
  expect(sectionForTaskType("new_blog")).toBe("content");
  expect(sectionForTaskType("improve_content")).toBe("content");
  expect(sectionForTaskType("geo_answers")).toBe("content");
  expect(sectionForTaskType("fix_meta")).toBe("meta");
});

test("every tab has I'll choose / Do automatically copy", () => {
  for (const s of RECOMMENDATION_SECTIONS) {
    expect(s.manualLabel).toBe("I'll choose");
    expect(s.autoLabel).toBe("Do automatically");
    expect(s.manualHint.length).toBeGreaterThan(10);
    expect(s.autoHint.length).toBeGreaterThan(10);
  }
  expect(RECOMMENDATION_SECTIONS.some((s) => s.key === "issues")).toBe(true);
  expect(RECOMMENDATION_SECTIONS.some((s) => s.key === "opportunities")).toBe(true);
});

test("readAutopilotMap falls back meta to auto_publish_meta", () => {
  expect(readAutopilotMap({ auto_publish_meta: true }).meta).toBe(true);
  expect(readAutopilotMap({ auto_publish_meta: false, recommendation_autopilot: { meta: true } }).meta).toBe(true);
  expect(readAutopilotMap({ recommendation_autopilot: { pages: true } }).pages).toBe(true);
  expect(readAutopilotMap({ recommendation_autopilot: { pages: true } }).content).toBe(false);
  expect(readAutopilotMap({ recommendation_autopilot: { issues: true } }).issues).toBe(true);
});

test("isDraftAutopilot uses the matching section", () => {
  const brand = {
    recommendation_autopilot: { pages: true, content: false, meta: true },
  };
  expect(isDraftAutopilot(brand, "new_page")).toBe(true);
  expect(isDraftAutopilot(brand, "new_blog")).toBe(false);
  expect(isDraftAutopilot(brand, "fix_meta")).toBe(true);
  expect(isSectionAutopilot(brand, "google_posts")).toBe(false);
  expect(isSectionAutopilot({ recommendation_autopilot: { opportunities: true } }, "opportunities")).toBe(true);
});
