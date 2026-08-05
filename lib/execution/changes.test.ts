// Unit tests for the draft -> SiteChange translation.
//
// This is the gate that decides what reaches a customer's live website, so it
// is the highest-consequence pure function in the codebase: a false positive
// here publishes a JSON audit blob as someone's landing page. Same convention
// as lib/auth.test.ts -- no I/O, no mocks, tested directly.

import { test, expect } from "vitest";
import { toSiteChange, type DraftLike } from "./changes";

function draft(over: Partial<DraftLike>): DraftLike {
  return {
    task_type: "new_page",
    title: "Page: junk removal cost",
    body: "TITLE TAG: Junk Removal Cost\nMETA: What it costs.\n\n# Heading\n\nReal body text.",
    target_url: null,
    target_keyword: "junk removal cost",
    ...over,
  };
}

test("new_page becomes an upsert_page with front matter split out", () => {
  const r = toSiteChange(draft({}), "Junk Free");
  expect(r.publishable).toBe(true);
  if (!r.publishable) return;
  expect(r.change).toEqual({
    type: "upsert_page",
    slug: "junk-removal-cost",
    title: "Junk Removal Cost",
    metaDescription: "What it costs.",
    bodyMarkdown: "# Heading\n\nReal body text.",
  });
});

test("new_blog is namespaced under blog/", () => {
  const r = toSiteChange(draft({ task_type: "new_blog" }), "Junk Free");
  expect(r.publishable).toBe(true);
  if (!r.publishable || r.change.type !== "upsert_page") return;
  expect(r.change.slug).toBe("blog/junk-removal-cost");
});

test("geo_answers publishes to faq with a brand-aware title", () => {
  const r = toSiteChange(
    draft({ task_type: "geo_answers", title: "AI-answer FAQ content (GEO/AEO)", target_keyword: null, body: "**Q?**\n\nA." }),
    "Junk Free"
  );
  expect(r.publishable).toBe(true);
  if (!r.publishable || r.change.type !== "upsert_page") return;
  expect(r.change.slug).toBe("faq");
  expect(r.change.title).toBe("Frequently Asked Questions — Junk Free");
});

test("improve_content is never publishable — it is an audit report", () => {
  const r = toSiteChange(
    draft({ task_type: "improve_content", body: '{"score":5,"checks":[{"item":"Title tag","status":"fail"}]}' }),
    "Junk Free"
  );
  expect(r.publishable).toBe(false);
  if (r.publishable) return;
  expect(r.reason).toMatch(/audit report/i);
});

test("fix_meta refuses to choose between the options it generated", () => {
  const body = JSON.stringify({ titles: ["A", "B", "C"], metas: ["m1", "m2", "m3"] });
  const r = toSiteChange(draft({ task_type: "fix_meta", body, target_url: "https://x.ca/p" }), "Junk Free");
  expect(r.publishable).toBe(false);
  if (r.publishable) return;
  expect(r.reason).toMatch(/Choose one/);
  expect(r.reason).toMatch(/3 title/);
});

test("fix_meta with an explicit choice becomes an update_meta", () => {
  const body = JSON.stringify({ titles: ["A", "B", "C"], metas: ["m1", "m2", "m3"] });
  const r = toSiteChange(draft({ task_type: "fix_meta", body, target_url: "https://x.ca/p" }), "Junk Free", 1);
  expect(r.publishable).toBe(true);
  if (!r.publishable) return;
  expect(r.change).toEqual({ type: "update_meta", url: "https://x.ca/p", title: "B", metaDescription: "m2" });
});

test("fix_meta rejects an out-of-range choice rather than falling back", () => {
  const body = JSON.stringify({ titles: ["A"], metas: ["m1"] });
  const r = toSiteChange(draft({ task_type: "fix_meta", body, target_url: "https://x.ca/p" }), "Junk Free", 7);
  expect(r.publishable).toBe(false);
});

test("an empty fix_meta body is reported as an empty generation, not bad JSON", () => {
  const r = toSiteChange(draft({ task_type: "fix_meta", body: "", target_url: "https://x.ca/p" }), "Junk Free");
  expect(r.publishable).toBe(false);
  if (r.publishable) return;
  expect(r.reason).toMatch(/empty body/);
});

test("fix_meta without a target_url has nothing to update", () => {
  const body = JSON.stringify({ titles: ["A"], metas: ["m"] });
  const r = toSiteChange(draft({ task_type: "fix_meta", body, target_url: null }), "Junk Free", 0);
  expect(r.publishable).toBe(false);
});

test("a page whose body is only front matter is not publishable", () => {
  const r = toSiteChange(draft({ body: "TITLE TAG: X\nMETA: Y" }), "Junk Free");
  expect(r.publishable).toBe(false);
  if (r.publishable) return;
  expect(r.reason).toMatch(/empty/i);
});

test("an unknown task type is refused rather than guessed at", () => {
  const r = toSiteChange(draft({ task_type: "technical_fix" }), "Junk Free");
  expect(r.publishable).toBe(false);
});

test("slug derivation falls back to the title when there is no keyword", () => {
  const r = toSiteChange(draft({ target_keyword: null, title: "Page: Same Day Service" }), "Junk Free");
  expect(r.publishable).toBe(true);
  if (!r.publishable || r.change.type !== "upsert_page") return;
  expect(r.change.slug).toBe("same-day-service");
});
