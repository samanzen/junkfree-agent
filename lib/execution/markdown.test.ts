// Unit tests for the Markdown -> HTML conversion used when publishing.
//
// Two things are being protected here: that the constructs writeContent()
// actually emits render correctly, and that model output can never inject
// markup or a javascript: URL into a customer's website.

import { test, expect } from "vitest";
import { markdownToHtml, excerptFrom } from "./markdown";

test("headings render at the right level", () => {
  expect(markdownToHtml("# One\n\n## Two\n\n### Three")).toBe("<h1>One</h1>\n<h2>Two</h2>\n<h3>Three</h3>");
});

test("blank-line separated paragraphs stay separate, wrapped lines join", () => {
  expect(markdownToHtml("first line\nsame para\n\nsecond para")).toBe(
    "<p>first line same para</p>\n<p>second para</p>"
  );
});

test("unordered and ordered lists render as their own blocks", () => {
  expect(markdownToHtml("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
  expect(markdownToHtml("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
});

test("switching list type closes the previous list", () => {
  expect(markdownToHtml("- a\n1. b")).toBe("<ul><li>a</li></ul>\n<ol><li>b</li></ol>");
});

test("bold, italic and links render", () => {
  expect(markdownToHtml("**bold** and *soft* and [x](/y)")).toBe(
    '<p><strong>bold</strong> and <em>soft</em> and <a href="/y">x</a></p>'
  );
});

test("images render and are not mistaken for links", () => {
  expect(markdownToHtml("![alt](https://c.dn/i.png)")).toBe('<p><img src="https://c.dn/i.png" alt="alt" /></p>');
});

test("HTML in model output is escaped, never emitted", () => {
  const out = markdownToHtml('<script>alert("x")</script>');
  expect(out).toBe("<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>");
  expect(out).not.toContain("<script>");
});

test("javascript: and data: URLs are refused, leaving the text inert", () => {
  expect(markdownToHtml("[click](javascript:alert(1))")).not.toContain("<a");
  expect(markdownToHtml("![x](data:text/html;base64,PHN2Zz4=)")).not.toContain("<img");
});

test("protocol-relative URLs are refused", () => {
  expect(markdownToHtml("[x](//evil.example)")).not.toContain("<a");
});

test("bold is not shredded into italics", () => {
  expect(markdownToHtml("**strong**")).toBe("<p><strong>strong</strong></p>");
});

test("ampersands in text are escaped", () => {
  expect(markdownToHtml("Bins & Bags")).toBe("<p>Bins &amp; Bags</p>");
});

test("excerpt takes the first real paragraph, stripped of markup", () => {
  expect(excerptFrom("# Title\n\nThe **real** [intro](/x) line.")).toBe("The real intro line.");
});

test("excerpt truncates on an ellipsis", () => {
  const long = "w".repeat(400);
  const out = excerptFrom(long, 20);
  expect(out).toHaveLength(20);
  expect(out.endsWith("…")).toBe(true);
});
