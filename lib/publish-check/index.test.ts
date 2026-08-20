import { expect, test } from "vitest";
import { absolutePageUrl, evaluateLivePage, expectedSnippet } from "./index";

test("relative paths resolve against the site origin", () => {
  expect(absolutePageUrl("https://junkfree.ca/", "yard-waste")).toBe("https://junkfree.ca/yard-waste");
  expect(absolutePageUrl("https://junkfree.ca", "/blog/x")).toBe("https://junkfree.ca/blog/x");
  expect(absolutePageUrl("https://junkfree.ca", "https://junkfree.ca/x")).toBe("https://junkfree.ca/x");
  expect(absolutePageUrl(null, "yard-waste")).toBeNull();
});

test("fetch failure is not treated as published", () => {
  const result = evaluateLivePage(null, {
    url: "https://junkfree.ca/yard-waste",
    changeType: "upsert_page",
    keyword: "yard waste",
  });
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/could not be fetched/i);
});

test("live page with the keyword verifies", () => {
  const result = evaluateLivePage(
    {
      url: "https://junkfree.ca/yard-waste",
      title: "Yard waste removal in Toronto",
      text: "We haul yard waste and garden debris same day.",
      words: 120,
    },
    {
      url: "https://junkfree.ca/yard-waste",
      changeType: "upsert_page",
      keyword: "yard waste",
      title: "Yard waste removal in Toronto",
    }
  );
  expect(result.ok).toBe(true);
});

test("empty live page after publish fails", () => {
  const result = evaluateLivePage(
    { url: "https://junkfree.ca/x", title: "", text: "ok", words: 2 },
    { url: "https://junkfree.ca/x", changeType: "upsert_page", keyword: "junk removal cost" }
  );
  expect(result.ok).toBe(false);
});

test("expected snippet strips title/meta lines", () => {
  const s = expectedSnippet("TITLE TAG: Hello\nMETA: Desc\n\nPeople hire us for junk removal every week in Toronto.");
  expect(s).toMatch(/People hire us/);
  expect(s).not.toMatch(/TITLE TAG/);
});
