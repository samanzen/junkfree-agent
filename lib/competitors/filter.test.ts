import { test, expect } from "vitest";
import {
  filterTrackableCompetitors,
  isTrackableCompetitor,
  normalizeCompetitorDomain,
} from "./filter";

test("normalizeCompetitorDomain strips scheme, www, path", () => {
  expect(normalizeCompetitorDomain("https://www.Facebook.com/pages/foo")).toBe("facebook.com");
  expect(normalizeCompetitorDomain("YELP.CA/biz/x")).toBe("yelp.ca");
});

test("social and directory hosts are not trackable competitors", () => {
  for (const d of [
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "instagram.com",
    "reddit.com",
    "youtube.com",
    "youtu.be",
    "yelp.com",
    "yelp.ca",
    "homestars.com",
    "linkedin.com",
    "tiktok.com",
  ]) {
    expect(isTrackableCompetitor(d, "junkfree.ca"), d).toBe(false);
  }
});

test("real business domains remain trackable", () => {
  expect(isTrackableCompetitor("1-800-got-junk.com", "junkfree.ca")).toBe(true);
  expect(isTrackableCompetitor("binthere.ca", "junkfree.ca")).toBe(true);
});

test("own domain is excluded", () => {
  expect(isTrackableCompetitor("junkfree.ca", "https://www.junkfree.ca/")).toBe(false);
});

test("filterTrackableCompetitors drops noise and keeps rivals", () => {
  const out = filterTrackableCompetitors(
    [
      { domain: "facebook.com", keywordOverlap: 40 },
      { domain: "rival-junk.ca", keywordOverlap: 12 },
      { domain: "yelp.ca", keywordOverlap: 30 },
      { domain: "junkfree.ca", keywordOverlap: 99 },
    ],
    "junkfree.ca"
  );
  expect(out.map((x) => x.domain)).toEqual(["rival-junk.ca"]);
});
