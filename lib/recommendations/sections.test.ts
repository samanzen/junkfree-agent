import { test, expect } from "vitest";
import {
  isDraftAutopilot,
  isSectionAutopilot,
  readAutopilotMap,
  sectionForTaskType,
} from "./sections";

test("sectionForTaskType maps draft kinds to tabs", () => {
  expect(sectionForTaskType("new_page")).toBe("pages");
  expect(sectionForTaskType("new_blog")).toBe("content");
  expect(sectionForTaskType("improve_content")).toBe("content");
  expect(sectionForTaskType("geo_answers")).toBe("content");
  expect(sectionForTaskType("fix_meta")).toBe("meta");
});

test("readAutopilotMap falls back meta to auto_publish_meta", () => {
  expect(readAutopilotMap({ auto_publish_meta: true }).meta).toBe(true);
  expect(readAutopilotMap({ auto_publish_meta: false, recommendation_autopilot: { meta: true } }).meta).toBe(true);
  expect(readAutopilotMap({ recommendation_autopilot: { pages: true } }).pages).toBe(true);
  expect(readAutopilotMap({ recommendation_autopilot: { pages: true } }).content).toBe(false);
});

test("isDraftAutopilot uses the matching section", () => {
  const brand = {
    recommendation_autopilot: { pages: true, content: false, meta: true },
  };
  expect(isDraftAutopilot(brand, "new_page")).toBe(true);
  expect(isDraftAutopilot(brand, "new_blog")).toBe(false);
  expect(isDraftAutopilot(brand, "fix_meta")).toBe(true);
  expect(isSectionAutopilot(brand, "google_posts")).toBe(false);
});
