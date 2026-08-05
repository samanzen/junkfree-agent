// Response-shape validation for the WordPress adapter.
//
// These exist because of a real failure found during verification: junkfree.ca
// is a single-page app that answers EVERY path with HTTP 200 and an HTML shell,
// including /wp-json/wp/v2/users/me and /this-path-cannot-exist-xyz. An adapter
// that trusts res.ok would report "authenticated to WordPress" against a site
// running no WordPress, then report a successful publish that never happened.
//
// Reporting a publish that did not occur is the worst failure this engine can
// have, so the guard against it is tested directly.

import { test, expect } from "vitest";
import { parseWpResource, parseWpCollection } from "./wordpress";

test("a real WP resource is accepted", () => {
  expect(parseWpResource({ id: 42, slug: "x", link: "https://s.ca/x" })).toMatchObject({ id: 42 });
});

test("an HTML shell served with 200 is rejected", () => {
  expect(parseWpResource("<!doctype html><html><head>…")).toBeNull();
});

test("a JSON object with no numeric id is rejected", () => {
  expect(parseWpResource({ slug: "x" })).toBeNull();
  expect(parseWpResource({ id: "42" })).toBeNull();
});

test("null and arrays are not single resources", () => {
  expect(parseWpResource(null)).toBeNull();
  expect(parseWpResource([{ id: 1 }])).toBeNull();
});

test("a collection of WP resources is accepted, including the empty one", () => {
  expect(parseWpCollection([{ id: 1 }, { id: 2 }])).toHaveLength(2);
  expect(parseWpCollection([])).toEqual([]); // no match for that slug — a valid answer
});

test("an HTML shell is not a collection", () => {
  expect(parseWpCollection("<!doctype html>")).toBeNull();
});

test("an array containing a non-resource is rejected wholesale", () => {
  expect(parseWpCollection([{ id: 1 }, { nope: true }])).toBeNull();
});

test("a bare object is not a collection", () => {
  expect(parseWpCollection({ id: 1 })).toBeNull();
});
