import fs from "fs";
import path from "path";
import { test, expect } from "vitest";
import {
  absolutizeMarkdownImages,
  displayWorkTitle,
  firstMarkdownImage,
  metaFromBody,
  pageFromBody,
  postTextWithoutImages,
  previewKindFor,
  queueHintFor,
  resolvePreviewSrc,
} from "./preview";

test("queue titles drop the agent prefix", () => {
  expect(displayWorkTitle("Page: junk removal calgary")).toBe("junk removal calgary");
  expect(displayWorkTitle("Blog: spring clean-out")).toBe("spring clean-out");
});

test("fix_meta and title/meta JSON are a search-result preview, not a page", () => {
  const body = JSON.stringify({ titles: ["Junk removal in Calgary"], metas: ["Book a same-day haul."] });
  expect(previewKindFor("fix_meta", body)).toBe("meta");
  expect(previewKindFor("new_blog", body)).toBe("meta");
  expect(metaFromBody(body)?.titles[0]).toBe("Junk removal in Calgary");
});

test("an audit JSON is not rendered as if it were a live page", () => {
  const body = JSON.stringify({ score: 40, checks: [{ item: "H1", status: "fail", fix: "Add one" }] });
  expect(previewKindFor("improve_content", body)).toBe("audit");
});

test("page drafts keep TITLE TAG / META off the article body", () => {
  const parsed = pageFromBody("TITLE TAG: Best junk removal\nMETA: Same-day.\n\n# Hello\n\nBody copy.", "Page: x");
  expect(parsed.title).toBe("Best junk removal");
  expect(parsed.meta).toBe("Same-day.");
  expect(parsed.markdown).toContain("# Hello");
  expect(parsed.markdown).not.toMatch(/TITLE TAG/);
});

test("the first http image is what the page and Google-post previews show", () => {
  const md = "Intro\n\n![Truck](https://cdn.example/truck.jpg)\n\nMore";
  expect(firstMarkdownImage(md)).toEqual({ alt: "Truck", src: "https://cdn.example/truck.jpg" });
  expect(firstMarkdownImage("![x](javascript:alert(1))")).toBeNull();
  expect(firstMarkdownImage("![x](data:image/png;base64,abc)")).toBeNull();
  expect(firstMarkdownImage("![Yard](/uploads/yard.jpg)")).toEqual({ alt: "Yard", src: "/uploads/yard.jpg" });
  expect(postTextWithoutImages(md)).toBe("Intro\n\nMore");
});

test("relative preview images pick up the brand site origin", () => {
  expect(resolvePreviewSrc("/uploads/yard.jpg", "https://junkfree.ca")).toBe("https://junkfree.ca/uploads/yard.jpg");
  expect(resolvePreviewSrc("https://cdn.example/a.jpg", "https://junkfree.ca")).toBe("https://cdn.example/a.jpg");
  expect(absolutizeMarkdownImages("![Yard](/uploads/yard.jpg)", "https://junkfree.ca"))
    .toBe("![Yard](https://junkfree.ca/uploads/yard.jpg)");
});

test("queue copy depends on what Preview will actually open", () => {
  expect(queueHintFor("new_page")).toMatch(/actual page/i);
  expect(queueHintFor("fix_meta")).toMatch(/search result/i);
  expect(queueHintFor("google_post", { brandName: "Junk Free" })).toMatch(/Junk Free/);
  expect(queueHintFor("improve_content", {
    body: JSON.stringify({ score: 40, checks: [{ item: "H1" }] }),
  })).toMatch(/audit/i);
});

test("recommendation queues show a title and Preview, not the draft body", () => {
  const rec = fs.readFileSync(path.join(process.cwd(), "app/dashboard/RecommendationsPanel.tsx"), "utf8");
  expect(rec).toContain("WorkPreview");
  expect(rec).toMatch(/>\s*Preview\s*</);
  expect(rec).not.toContain("DraftBody");
  expect(rec).not.toMatch(/<pre[\s>]/);
  expect(rec).not.toMatch(/\{d\.body\}/);
  expect(rec).not.toMatch(/\{g\.body\}/);

  const portal = fs.readFileSync(path.join(process.cwd(), "app/portal/content/page.tsx"), "utf8");
  expect(portal).toContain("WorkPreview");
  expect(portal).toMatch(/>\s*Preview\s*</);
  expect(portal).not.toMatch(/body=\{draft\.body\}/);
  expect(portal).not.toMatch(/body=\{post\.body\}/);
});
