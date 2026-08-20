import { test, expect } from "vitest";
import { attachGapSources } from "./gaps";

test("a planner gap picks up the competitor who actually ranks for that keyword", () => {
  const sourced = attachGapSources(
    [{ keyword: "junk removal cost", volume: 0, why: "pricing page gap", page_type: "new_page" }],
    [
      { keyword: "Junk Removal Cost", position: 4, volume: 1900, competitor: "rivaljunk.ca" },
      { keyword: "sofa disposal", position: 2, volume: 400, competitor: "other.ca" },
    ]
  );
  expect(sourced).toHaveLength(1);
  expect(sourced[0].competitor).toBe("rivaljunk.ca");
  expect(sourced[0].competitor_position).toBe(4);
  expect(sourced[0].volume).toBe(1900);
});

test("unmatched gaps stay without a competitor name", () => {
  const sourced = attachGapSources(
    [{ keyword: "same-day junk removal", volume: 320, why: "speed", page_type: "new_page" }],
    [{ keyword: "junk removal cost", position: 1, volume: 1900, competitor: "rivaljunk.ca" }]
  );
  expect(sourced[0].competitor).toBeUndefined();
  expect(sourced[0].volume).toBe(320);
});
