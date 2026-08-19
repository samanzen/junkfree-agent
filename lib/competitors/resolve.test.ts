import { test, expect } from "vitest";
import {
  looksLikeDomain,
  nameToSlug,
  nameToDomainCandidates,
  preferTldFromSite,
} from "./resolve";

test("looksLikeDomain accepts hosts and rejects bare names", () => {
  expect(looksLikeDomain("junk-king.com")).toBe(true);
  expect(looksLikeDomain("https://www.JustJunk.ca/path")).toBe(true);
  expect(looksLikeDomain("just junk")).toBe(false);
  expect(looksLikeDomain("JustJunk")).toBe(false);
  expect(looksLikeDomain("justjunk")).toBe(false);
});

test("nameToSlug collapses business names", () => {
  expect(nameToSlug("Just Junk")).toBe("justjunk");
  expect(nameToSlug("JustJunk")).toBe("justjunk");
  expect(nameToSlug("  1-800-GOT-JUNK! ")).toBe("1800gotjunk");
});

test("nameToDomainCandidates prefers brand TLD", () => {
  const ca = nameToDomainCandidates("Just Junk", "ca");
  expect(ca[0]).toBe("justjunk.ca");
  expect(ca).toContain("justjunk.com");

  const com = nameToDomainCandidates("Acme Roofing", "com");
  expect(com[0]).toBe("acmeroofing.com");
});

test("preferTldFromSite reads the brand website TLD", () => {
  expect(preferTldFromSite("https://www.junkfree.ca/")).toBe("ca");
  expect(preferTldFromSite("https://acme.com")).toBe("com");
  expect(preferTldFromSite("https://shop.example.co.uk")).toBe("co.uk");
});
