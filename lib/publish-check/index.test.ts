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

test("matching title verifies a new page", () => {
  const result = evaluateLivePage(
    {
      url: "https://junkfree.ca/yard-waste",
      title: "Yard waste removal in Toronto",
      text: "We haul yard waste and garden debris same day.",
      words: 12,
    },
    {
      url: "https://junkfree.ca/yard-waste",
      changeType: "upsert_page",
      title: "Yard waste removal in Toronto",
    }
  );
  expect(result.ok).toBe(true);
});

test("matching body snippet verifies a new page", () => {
  const snippet = expectedSnippet("People hire us for junk removal every week in Toronto.")!;
  const result = evaluateLivePage(
    {
      url: "https://junkfree.ca/x",
      title: "Something else",
      text: "People hire us for junk removal every week in Toronto. More copy here.",
      words: 14,
    },
    { url: "https://junkfree.ca/x", changeType: "upsert_page", bodySnippet: snippet }
  );
  expect(result.ok).toBe(true);
});

test("keyword-only match is not enough", () => {
  const result = evaluateLivePage(
    {
      url: "https://junkfree.ca/yard-waste",
      title: "Home",
      text: "We mention yard waste somewhere on an unrelated page.",
      words: 120,
    },
    {
      url: "https://junkfree.ca/yard-waste",
      changeType: "upsert_page",
      keyword: "yard waste",
      title: "Yard waste removal in Toronto",
    }
  );
  expect(result.ok).toBe(false);
});

test("an unrelated page with enough words is not treated as published", () => {
  const result = evaluateLivePage(
    {
      url: "https://junkfree.ca/x",
      title: "Welcome to our site",
      text: "A ".repeat(90),
      words: 90,
    },
    {
      url: "https://junkfree.ca/x",
      changeType: "upsert_page",
      title: "Yard waste removal in Toronto",
      bodySnippet: "People hire us for junk removal every week in Toronto.",
    }
  );
  expect(result.ok).toBe(false);
  expect(result.reason).not.toMatch(/substantial text/i);
});

test("empty live page after publish fails", () => {
  const result = evaluateLivePage(
    { url: "https://junkfree.ca/x", title: "", text: "ok", words: 2 },
    { url: "https://junkfree.ca/x", changeType: "upsert_page", title: "Junk removal cost" }
  );
  expect(result.ok).toBe(false);
});

test("meta publish requires the expected title, not just any title", () => {
  const miss = evaluateLivePage(
    { url: "https://junkfree.ca/x", title: "Old title here", text: "body", words: 20, meta: "old" },
    { url: "https://junkfree.ca/x", changeType: "update_meta", title: "New unique title for the page" }
  );
  expect(miss.ok).toBe(false);

  const hit = evaluateLivePage(
    { url: "https://junkfree.ca/x", title: "New unique title for the page", text: "body", words: 20, meta: "old" },
    { url: "https://junkfree.ca/x", changeType: "update_meta", title: "New unique title for the page" }
  );
  expect(hit.ok).toBe(true);
});

test("meta publish can verify the description", () => {
  const result = evaluateLivePage(
    {
      url: "https://junkfree.ca/x",
      title: "Same",
      text: "body",
      words: 20,
      meta: "Same-day junk removal across the Lower Mainland.",
    },
    {
      url: "https://junkfree.ca/x",
      changeType: "update_meta",
      metaDescription: "Same-day junk removal across the Lower Mainland.",
    }
  );
  expect(result.ok).toBe(true);
});

test("expected snippet strips title/meta lines", () => {
  const s = expectedSnippet("TITLE TAG: Hello\nMETA: Desc\n\nPeople hire us for junk removal every week in Toronto.");
  expect(s).toMatch(/People hire us/);
  expect(s).not.toMatch(/TITLE TAG/);
});
