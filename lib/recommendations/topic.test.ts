import { test, expect } from "vitest";
import { overlapsTopic, siblingDrafts, topicKey, topicSlug, uniqueByTopic } from "./topic";

test("a keyword and its planned URL are the same topic", () => {
  expect(topicSlug({ keyword: "junk removal cost" })).toBe("junk-removal-cost");
  expect(topicSlug({ url: "https://www.junkfree.ca/junk-removal-cost" })).toBe("junk-removal-cost");
  expect(topicKey({ taskType: "new_page", keyword: "Junk Removal Cost" }))
    .toBe(topicKey({ task_type: "new_page", target_url: "https://www.junkfree.ca/junk-removal-cost" }));
});

test("two new-page drafts for junk removal cost collapse to one", () => {
  const a = { id: "1", task_type: "new_page", target_keyword: "junk removal cost", title: "Page: junk removal cost", body: "short", status: "pending_review" };
  const b = { id: "2", task_type: "new_page", target_keyword: "junk removal cost", title: "Page: junk removal cost", body: "a much longer draft body", status: "pending_review" };
  const kept = uniqueByTopic([a, b]);
  expect(kept).toHaveLength(1);
  expect(kept[0].id).toBe("2");
  expect(siblingDrafts(a, [a, b]).map((d) => d.id)).toEqual(["2"]);
});

test("a keyword draft and a URL-only twin are the same card", () => {
  const a = { id: "1", task_type: "new_page", target_keyword: "junk removal cost", title: "Page: junk removal cost", body: "one", status: "pending_review" };
  const b = { id: "2", task_type: "new_page", target_url: "https://www.junkfree.ca/junk-removal-cost", title: "Page: junk removal cost", body: "two is longer", status: "pending_review" };
  expect(uniqueByTopic([a, b])).toHaveLength(1);
});

test("a pending twin is kept over an approved copy of the same topic", () => {
  const approved = { id: "1", task_type: "new_page", target_keyword: "junk removal cost", body: "xxxxxxxxxxxxxxxxxxxx", status: "approved" };
  const pending = { id: "2", task_type: "new_page", target_keyword: "junk removal cost", body: "short", status: "pending_review" };
  expect(uniqueByTopic([approved, pending])[0].id).toBe("2");
});

test("a page and a blog on the same words stay separate", () => {
  const page = { id: "1", task_type: "new_page", target_keyword: "junk removal cost", body: "p" };
  const blog = { id: "2", task_type: "new_blog", target_keyword: "junk removal cost", body: "b" };
  expect(uniqueByTopic([page, blog])).toHaveLength(2);
});

test("overlapsTopic catches the URL-only twin the planner used to enqueue", () => {
  expect(overlapsTopic("junk removal cost", {
    target_url: "https://www.junkfree.ca/junk-removal-cost",
    title: "Page: junk removal cost",
  })).toBe(true);
  expect(overlapsTopic("sofa disposal", { keyword: "junk removal cost" })).toBe(false);
  expect(overlapsTopic("junk", { keyword: "junk removal cost" })).toBe(false);
});
