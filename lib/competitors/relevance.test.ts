import { test, expect } from "vitest";
import { applyOverlapFloor, MIN_KEYWORD_OVERLAP } from "./relevance";

test("applyOverlapFloor drops weak keyword-overlap hits", () => {
  const out = applyOverlapFloor([
    { domain: "real-mover.ca", keywordOverlap: 40 },
    { domain: "noise-site.com", keywordOverlap: 2 },
    { domain: "another-mover.com", keywordOverlap: MIN_KEYWORD_OVERLAP },
  ]);
  expect(out.map((x) => x.domain)).toEqual(["real-mover.ca", "another-mover.com"]);
});

test("applyOverlapFloor keeps top rows when everything is below the floor", () => {
  const out = applyOverlapFloor([
    { domain: "a.com", keywordOverlap: 3 },
    { domain: "b.com", keywordOverlap: 4 },
    { domain: "c.com", keywordOverlap: 1 },
  ]);
  expect(out[0].domain).toBe("b.com");
  expect(out.length).toBeLessThanOrEqual(8);
});
