import { test, expect } from "vitest";
import {
  analyzeAnswer,
  extractStructuredNames,
  identityOf,
  identityPhrases,
  isSameDomain,
  looksLikeBusinessName,
  mentionsPhrase,
  normalizeForMatch,
  sentimentForBrand,
} from "./analyze";
import type { AnswerCitation, BrandIdentity } from "./types";

const IDENTITY: BrandIdentity = {
  name: "Junk Free",
  domain: "junkfree.ca",
  aliases: ["Junk Free Calgary"],
  competitors: [
    { name: "1-800-GOT-JUNK", domain: "1800gotjunk.com" },
    { name: "Bin There Dump That", domain: "binthere.ca" },
  ],
};

const cite = (url: string, title: string | null = null, position = 1): AnswerCitation => ({ url, title, position });

// ── Matching primitives ─────────────────────────────────────────────────────
test("normalisation removes case, accents and punctuation", () => {
  expect(normalizeForMatch("Café  Déjà-Vu!")).toBe("cafe deja vu");
});

test("phrase matching respects word boundaries", () => {
  // A raw substring test would report a mention of "Free" inside "Freedom".
  expect(mentionsPhrase("We recommend Junk Free for this", "Junk Free")).toBe(true);
  expect(mentionsPhrase("Freedom Movers are great", "Free")).toBe(false);
  expect(mentionsPhrase("junk-free is solid", "Junk Free")).toBe(true);
});

test("a short domain label is not matched in prose", () => {
  // "ace" would otherwise match inside any sentence containing the word.
  expect(identityPhrases("Ace", "ace.com")).not.toContain("ace");
  expect(identityPhrases("Junk Free", "junkfree.ca")).toContain("junkfree");
});

test("subdomains count as the same site", () => {
  expect(isSameDomain("www.junkfree.ca", "junkfree.ca")).toBe(true);
  expect(isSameDomain("blog.junkfree.ca", "junkfree.ca")).toBe(true);
  expect(isSameDomain("junkfree.com", "junkfree.ca")).toBe(false);
  expect(isSameDomain(null, "junkfree.ca")).toBe(false);
});

// ── Name extraction ─────────────────────────────────────────────────────────
test("numbered, bulleted and bolded names are all extracted in order", () => {
  const text = [
    "1. Junk Free — fast and affordable",
    "2. 1-800-GOT-JUNK: national brand",
    "- Bin There Dump That (bin rental)",
    "**Redbin Disposal** also serves the area",
  ].join("\n");
  expect(extractStructuredNames(text)).toEqual([
    "Junk Free",
    "1-800-GOT-JUNK",
    "Bin There Dump That",
    "Redbin Disposal",
  ]);
});

test("bulleted advice is not mistaken for a business", () => {
  const text = ["- Check reviews before hiring anyone", "- Make sure they are insured", "1. Junk Free"].join("\n");
  expect(extractStructuredNames(text)).toEqual(["Junk Free"]);
});

test("business-name plausibility rejects prose and accepts real names", () => {
  expect(looksLikeBusinessName("Junk Free")).toBe(true);
    expect(looksLikeBusinessName("1-800-GOT-JUNK")).toBe(true);
  expect(looksLikeBusinessName("check their insurance and licensing first")).toBe(false);
  expect(looksLikeBusinessName("Consider the following options")).toBe(false);
  expect(looksLikeBusinessName("a")).toBe(false);
});

// ── Sentiment ───────────────────────────────────────────────────────────────
test("sentiment reads only the sentences naming the brand", () => {
  // Praise of a rival elsewhere must not be credited to us.
  const text = "Junk Free has mixed reviews. 1-800-GOT-JUNK is excellent and highly recommended.";
  expect(sentimentForBrand(text, ["Junk Free"])).toBe("negative");
});

test("cue-free text is neutral rather than forced into a polarity", () => {
  expect(sentimentForBrand("Junk Free operates in Calgary.", ["Junk Free"])).toBe("neutral");
});

test("sentiment is null when the brand is absent", () => {
  expect(sentimentForBrand("Some other company entirely.", ["Junk Free"])).toBeNull();
});

// ── Full analysis ───────────────────────────────────────────────────────────
test("a listed brand gets its rank, share of voice and sentiment", () => {
  const text = [
    "1. 1-800-GOT-JUNK — national coverage",
    "2. Junk Free — reliable and affordable local option",
    "3. Bin There Dump That — bin rental",
  ].join("\n");

  const result = analyzeAnswer(text, [], IDENTITY);
  expect(result.mentioned).toBe(true);
  expect(result.rank).toBe(2);
  expect(result.brandsNamed.map((b) => b.name)).toEqual([
    "1-800-GOT-JUNK",
    "Junk Free",
    "Bin There Dump That",
  ]);
  expect(result.brandsNamed[1].isOwn).toBe(true);
  expect(result.shareOfVoice).toBeCloseTo(33.33, 1);
  expect(result.sentiment).toBe("positive");
});

test("an absent brand has no rank and zero share", () => {
  const text = "1. 1-800-GOT-JUNK\n2. Bin There Dump That";
  const result = analyzeAnswer(text, [], IDENTITY);
  expect(result.mentioned).toBe(false);
  expect(result.rank).toBeNull();
  expect(result.shareOfVoice).toBe(0);
  expect(result.sentiment).toBeNull();
});

test("an alias in a list is recognised as us, not as a third party", () => {
  const result = analyzeAnswer("1. Junk Free Calgary — local specialists", [], IDENTITY);
  expect(result.rank).toBe(1);
  expect(result.brandsNamed[0].isOwn).toBe(true);
  expect(result.shareOfVoice).toBe(100);
});

test("being cited without being named still counts as visible", () => {
  // The case that most often goes unnoticed: the assistant used our page as a
  // source but recommended someone else by name.
  const result = analyzeAnswer(
    "1. 1-800-GOT-JUNK — national coverage",
    [cite("https://junkfree.ca/calgary", "Junk removal Calgary", 1)],
    IDENTITY
  );
  expect(result.mentioned).toBe(true);
  expect(result.rank).toBeNull();
  expect(result.ownUrlsCited).toEqual(["https://junkfree.ca/calgary"]);
});

test("citations are attributed to the right side", () => {
  const result = analyzeAnswer("1. Junk Free", [
    cite("https://www.junkfree.ca/services", null, 1),
    cite("https://1800gotjunk.com/ca", null, 2),
    cite("https://yelp.ca/biz/whatever", null, 3),
  ], IDENTITY);

  expect(result.citations.map((c) => c.isOwn)).toEqual([true, false, false]);
  expect(result.citations.map((c) => c.domain)).toEqual(["junkfree.ca", "1800gotjunk.com", "yelp.ca"]);
  expect(result.ownUrlsCited).toHaveLength(1);
});

test("a duplicate own URL is counted once", () => {
  const result = analyzeAnswer("1. Junk Free", [
    cite("https://junkfree.ca/x", null, 1),
    cite("https://junkfree.ca/x", null, 2),
  ], IDENTITY);
  expect(result.ownUrlsCited).toEqual(["https://junkfree.ca/x"]);
});

test("a known competitor mentioned only in prose is still recorded, in order", () => {
  const text = "Junk Free is a good local choice. Bin There Dump That is another option.";
  const result = analyzeAnswer(text, [], IDENTITY);
  expect(result.brandsNamed.map((b) => b.name)).toEqual(["Junk Free", "Bin There Dump That"]);
  expect(result.rank).toBe(1);
});

test("an empty answer produces an empty, non-throwing verdict", () => {
  const result = analyzeAnswer("", [], IDENTITY);
  expect(result.mentioned).toBe(false);
  expect(result.brandsNamed).toEqual([]);
  expect(result.shareOfVoice).toBe(0);
});

test("the same business named twice is counted once", () => {
  const text = "1. Junk Free — great\n2. Junk Free — also listed twice";
  const result = analyzeAnswer(text, [], IDENTITY);
  expect(result.brandsNamed).toHaveLength(1);
  expect(result.shareOfVoice).toBe(100);
});

// ── Identity assembly ───────────────────────────────────────────────────────
test("identity is built from the brand row, treating dotted entries as domains", () => {
  const identity = identityOf({
    name: "Junk Free",
    site_url: "https://www.junkfree.ca/",
    competitors: "1-800-GOT-JUNK, binthere.ca",
  });
  expect(identity.domain).toBe("junkfree.ca");
  expect(identity.competitors).toEqual([
    { name: "1-800-GOT-JUNK", domain: null },
    { name: "binthere.ca", domain: "binthere.ca" },
  ]);
});

test("tracked competitors merge with the brand field without duplicating", () => {
  const identity = identityOf(
    { name: "Junk Free", site_url: "https://junkfree.ca", competitors: "binthere.ca" },
    { competitors: [{ name: "binthere.ca", domain: "binthere.ca" }, { name: "Redbin", domain: "redbin.ca" }] }
  );
  expect(identity.competitors.map((c) => c.name)).toEqual(["binthere.ca", "Redbin"]);
});
