import fs from "fs";
import path from "path";
import { test, expect } from "vitest";
import {
  absolutizeMarkdownImages,
  buildDecisionReport,
  decisionWhy,
  displayWorkTitle,
  firstMarkdownImage,
  metaFromBody,
  pageFromBody,
  plannedPageUrl,
  postTextWithoutImages,
  previewKindFor,
  resolvePreviewSrc,
  rewritePlanFromBody,
} from "./preview";

test("queue titles drop the agent prefix", () => {
  expect(displayWorkTitle("Page: junk removal calgary")).toBe("junk removal calgary");
  expect(displayWorkTitle("Blog: spring clean-out")).toBe("spring clean-out");
  expect(displayWorkTitle("Audit + rewrite: https://www.junkfree.ca/blog/furniture-disposal-vancouver"))
    .toBe("furniture disposal vancouver");
});

test("fix_meta and title/meta JSON are a search-result preview, not a page", () => {
  const body = JSON.stringify({ titles: ["Junk removal in Calgary"], metas: ["Book a same-day haul."] });
  expect(previewKindFor("fix_meta", body)).toBe("meta");
  expect(previewKindFor("new_blog", body)).toBe("meta");
  expect(metaFromBody(body)?.titles[0]).toBe("Junk removal in Calgary");
});

test("improve_content is always a plan, even when the body is messy JSON", () => {
  const body = JSON.stringify({ score: 40, checks: [{ item: "H1", status: "fail", fix: "Add one" }] });
  expect(previewKindFor("improve_content", body)).toBe("audit");
  expect(previewKindFor("improve_content", "not json at all")).toBe("audit");
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

test("new pages and blogs advertise the URL they will actually publish to", () => {
  expect(plannedPageUrl({
    taskType: "new_page",
    title: "Page: same-day junk removal Vancouver",
    targetKeyword: "same-day junk removal Vancouver",
    siteUrl: "https://www.junkfree.ca",
  })).toBe("https://www.junkfree.ca/same-day-junk-removal-vancouver");
  expect(plannedPageUrl({
    taskType: "new_blog",
    title: "Blog: furniture disposal",
    targetKeyword: "furniture disposal vancouver",
    siteUrl: "https://www.junkfree.ca/",
  })).toBe("https://www.junkfree.ca/blog/furniture-disposal-vancouver");
  expect(plannedPageUrl({
    taskType: "improve_content",
    title: "Audit + rewrite: https://www.junkfree.ca/blog/furniture-disposal-vancouver",
    targetUrl: "https://www.junkfree.ca/blog/furniture-disposal-vancouver",
    siteUrl: "https://www.junkfree.ca",
  })).toBe("https://www.junkfree.ca/blog/furniture-disposal-vancouver");
});

test("a rewrite plan is numbered English, never JSON", () => {
  const body = JSON.stringify({
    score: 48,
    checks: [
      { item: "Title tag", status: "fail", fix: "No title tag content provided. Create one using the paid-intent keyword." },
      { item: "Meta description", status: "fail", fix: "No meta description present. Write one leading with pricing transparency." },
      { item: "H1", status: "pass", fix: "Looks fine" },
    ],
  });
  const plan = rewritePlanFromBody(body, { keyword: "furniture disposal", url: "https://x.ca/p" });
  expect(plan.steps).toHaveLength(2);
  expect(plan.steps[0].n).toBe(1);
  expect(plan.steps[0].title.toLowerCase()).toMatch(/title/);
  expect(plan.steps[0].detail.toLowerCase()).toMatch(/google title/);
  expect(plan.steps[0].detail.toLowerCase()).not.toMatch(/paid-intent/);
  expect(plan.steps[0].detail.toLowerCase()).not.toMatch(/\bthe the\b/);
  expect(plan.intro).not.toMatch(/\{/);
  expect(JSON.stringify(plan)).not.toMatch(/"score"/);
});

test("a rewrite plan reads JSON buried in Claude prose and fences", () => {
  const body = `Here is the audit for recycle waste services.

\`\`\`json
{"score":42,"checks":[
  {"item":"Title tag","status":"fail","fix":"No title tag content provided. Create one using the paid-intent keyword."},
  {"item":"Meta description","status":"fail","fix":"Write a meta description."},
  {"item":"H1","status":"pass","fix":"Looks fine"}
]}
\`\`\`

Let me know if you want a deeper pass.`;
  const plan = rewritePlanFromBody(body, {
    keyword: "recycle waste services",
    url: "https://www.junkfree.ca/services/recycling-donation-services",
  });
  expect(plan.steps).toHaveLength(2);
  expect(plan.intro).toMatch(/recycle waste services/);
  expect(plan.intro).not.toMatch(/could not turn the review/);
  expect(plan.steps[0].detail.toLowerCase()).toMatch(/google title/);
  expect(plan.steps[0].detail.toLowerCase()).not.toMatch(/paid-intent/);
  expect(JSON.stringify(plan)).not.toMatch(/"score"/);
});

test("older issue-shaped audits still become a numbered plan", () => {
  const body = "Notes first.\n" + JSON.stringify({
    issues: [
      { problem: "Missing H1", severity: "high", fix: "Add one main heading." },
    ],
  });
  const plan = rewritePlanFromBody(body, { keyword: "junk removal" });
  expect(plan.steps).toHaveLength(1);
  expect(plan.steps[0].title.toLowerCase()).toMatch(/heading/);
});

test("why copy talks like the agent and uses the actual findings", () => {
  const body = JSON.stringify({
    score: 40,
    checks: [
      { item: "Title tag", status: "fail", fix: "Add a title tag." },
      { item: "Meta description", status: "fail", fix: "Add a meta description." },
    ],
  });
  const why = decisionWhy({
    kind: "draft",
    taskType: "improve_content",
    keyword: "recycle waste services",
    url: "https://www.junkfree.ca/services/recycling-donation-services",
    rationale: "Search-intent qualification.",
    body,
  });
  expect(why).toMatch(/recycle waste services/);
  expect(why).toMatch(/recycling-donation-services/);
  expect(why).toMatch(/Google title/);
  expect(why).toMatch(/ready to book/);
  expect(why.toLowerCase()).not.toMatch(/i opened/);
  expect(why.toLowerCase()).not.toMatch(/title tag/);
  expect(why.toLowerCase()).not.toMatch(/paid-intent/);
  expect(why.toLowerCase()).not.toMatch(/schema\.org/);
  expect(why).not.toMatch(/could not turn/);
});

test("a new blog why does not invent competitor ranks", () => {
  const why = decisionWhy({
    kind: "draft",
    taskType: "new_blog",
    keyword: "furniture disposal vancouver",
    rationale: "High-intent local topic with no matching post.",
  });
  expect(why).toMatch(/furniture disposal vancouver/);
  expect(why.toLowerCase()).not.toMatch(/competitor \d/);
  expect(why.toLowerCase()).not.toMatch(/ranking #/);
});

test("why cites stored search volume instead of a generic people-search line", () => {
  const why = decisionWhy({
    kind: "draft",
    taskType: "new_page",
    keyword: "junk removal cost",
    facts: { volume: 1200 },
  });
  expect(why).toMatch(/1[,.]?200/);
  expect(why).toMatch(/junk removal cost/);
  expect(why.toLowerCase()).toMatch(/search volume/);
  expect(why.toLowerCase()).not.toMatch(/not ranking/);
  expect(why.toLowerCase()).not.toMatch(/blah/);
});

test("a new page why without a stored volume does not invent search demand", () => {
  const why = decisionWhy({
    kind: "draft",
    taskType: "new_page",
    keyword: "junk removal cost",
    rationale: "No baseline data exists yet, and this is a core high-intent commercial query with real search volume. A dedicated pricing-transparency page captures cost-focused searchers.",
  });
  expect(why).toMatch(/junk removal cost/);
  expect(why).toMatch(/pricing-transparency/);
  expect(why.toLowerCase()).not.toMatch(/people search/);
  expect(why.toLowerCase()).not.toMatch(/real search volume/);
});

test("the decision report is the technical logic and omits facts we do not have", () => {
  const report = buildDecisionReport({
    kind: "draft",
    taskType: "new_page",
    keyword: "junk removal cost",
    rationale: "Core high-intent query.",
  });
  const headings = report.sections.map((s) => s.heading);
  expect(headings).toContain("The decision");
  expect(headings).toContain("Why");
  expect(headings).not.toContain("What we measured");
  expect(headings).not.toContain("Who worked on this");
  expect(headings).not.toContain("Signals used");
  expect(JSON.stringify(report).toLowerCase()).not.toMatch(/ranking #/);
  expect(JSON.stringify(report).toLowerCase()).not.toMatch(/not stored/);
  expect(JSON.stringify(report).toLowerCase()).not.toMatch(/does not exist/);
  expect(JSON.stringify(report).toLowerCase()).not.toMatch(/i opened/);
});

test("the decision report lists audit problems and recommended changes", () => {
  const body = JSON.stringify({
    score: 40,
    checks: [
      { item: "Title tag", status: "fail", fix: "Create a title using the paid-intent keyword." },
      { item: "H1", status: "fail", fix: "Add one main heading." },
      { item: "Images", status: "pass", fix: "Looks fine" },
    ],
  });
  const report = buildDecisionReport({
    kind: "draft",
    taskType: "improve_content",
    keyword: "recycle waste services",
    url: "https://www.junkfree.ca/services/recycling-donation-services",
    body,
  });
  const blob = JSON.stringify(report);
  expect(report.sections.some((s) => s.heading === "Technical problems")).toBe(true);
  expect(report.sections.some((s) => s.heading === "Recommended changes")).toBe(true);
  expect(blob).toMatch(/40\/100/);
  expect(blob).toMatch(/Google title/);
  expect(blob.toLowerCase()).not.toMatch(/paid-intent/);
  expect(blob.toLowerCase()).not.toMatch(/i opened/);
});

test("a new-page report includes the draft outline when the body has headings", () => {
  const report = buildDecisionReport({
    kind: "draft",
    taskType: "new_page",
    keyword: "junk removal cost",
    title: "Page: junk removal cost",
    rationale: "A dedicated pricing-transparency page captures cost-focused searchers.",
    body: "TITLE TAG: Junk removal cost in Vancouver\nMETA: See how quotes are priced.\n\n# Junk removal cost\n\n## How quotes work\n\n## What affects the price\n\n## Request a quote\n",
  });
  const outline = report.sections.find((s) => s.heading === "What the draft covers");
  expect(outline?.body).toMatch(/How quotes work/);
  expect(outline?.body).toMatch(/Request a quote/);
  expect(report.sections.some((s) => s.heading === "Signals used")).toBe(false);
});

test("boilerplate why-copy is rewritten for a customer", () => {
  expect(decisionWhy({
    kind: "draft",
    taskType: "fix_meta",
    rationale: "Search-intent qualification.",
    keyword: "junk removal",
  })).toMatch(/ready to book/);
  expect(decisionWhy({ kind: "google_post" })).toMatch(/Business Profile/);
  expect(decisionWhy({
    kind: "backlink",
    title: "Calgary Chamber",
    rationale: "Chamber listing that competitors already have.",
  })).toMatch(/Chamber/);
});

test("recommendation queues show title, URL, Preview, Approve and Why — not the draft body", () => {
  const rec = fs.readFileSync(path.join(process.cwd(), "app/dashboard/RecommendationsPanel.tsx"), "utf8");
  expect(rec).toContain("WorkPreview");
  expect(rec).toMatch(/>\s*Preview\s*</);
  expect(rec).toMatch(/>\s*Approve\s*</);
  expect(rec).toMatch(/>\s*Why\s*</);
  expect(rec).toMatch(/>\s*More\s*</);
  expect(rec).toContain("uniqueByTopic");
  expect(rec).toContain("DecisionReport");
  expect(rec).not.toContain("DraftBody");
  expect(rec).not.toMatch(/Open Preview to see/);
  expect(rec).not.toMatch(/<pre[\s>]/);
  expect(rec).not.toMatch(/\{d\.body\}/);
  expect(rec).not.toMatch(/\{g\.body\}/);

  const portal = fs.readFileSync(path.join(process.cwd(), "app/portal/content/page.tsx"), "utf8");
  expect(portal).toContain("WorkPreview");
  expect(portal).toMatch(/>\s*Preview\s*</);
  expect(portal).toContain('"Approve"');
  expect(portal).toMatch(/>\s*Why\s*</);
  expect(portal).toMatch(/>\s*More\s*</);
  expect(portal).toContain("DecisionReport");
  expect(portal).not.toMatch(/Open Preview to see/);
  expect(portal).not.toMatch(/body=\{draft\.body\}/);
  expect(portal).not.toMatch(/body=\{post\.body\}/);

  const overlay = fs.readFileSync(path.join(process.cwd(), "app/_components/WorkPreview.tsx"), "utf8");
  expect(overlay).toContain("Why this is queued");
  expect(overlay).toContain("rewritePlanFromBody");
});
