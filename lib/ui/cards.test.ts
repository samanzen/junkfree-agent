// Priority 2: no dead-end cards.
//
// The defect: ConnectCard rendered a hardcoded "Available" tag while both its
// CTA and its explanatory note were optional. A card could therefore claim to
// be available while offering no action and no explanation. 26 of 49 cards in
// the portal were in exactly that state, 14 of them in the reviewed modules.
//
// The fix is a type, not a sweep: a card must supply a `cta` (it goes
// somewhere real) or a `requirement` (it says what is needed). These tests
// guard that the type stays that shape and that no instance regresses.

import fs from "fs";
import { test, expect } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(`${ROOT}/${dir}`, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, acc);
    else if (p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

/** Every <ConnectCard .../> block in the portal, with its source file. */
function allCards(): { file: string; block: string; title: string }[] {
  const out: { file: string; block: string; title: string }[] = [];
  for (const f of walk("app/portal")) {
    const src = read(f);
    let i = 0;
    while ((i = src.indexOf("<ConnectCard", i)) !== -1) {
      let depth = 0, end = -1;
      for (let j = i; j < src.length; j++) {
        const c = src[j];
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0 && src[j - 1] === "/") { end = j + 1; break; }
      }
      if (end === -1) break;
      const block = src.slice(i, end);
      out.push({ file: f, block, title: block.match(/title="([^"]*)"/)?.[1] || "(untitled)" });
      i = end;
    }
  }
  return out;
}

test("the audit finds cards at all (guards the parser itself)", () => {
  // A broken extractor would make every assertion below vacuously pass.
  expect(allCards().length).toBeGreaterThan(40);
});

test("no card is a dead end", () => {
  const dead = allCards()
    .filter((c) => !/cta=\{/.test(c.block) && !/requirement=/.test(c.block))
    .map((c) => `${c.file}: ${c.title}`);
  expect(dead).toEqual([]);
});

test("the reviewed modules have no dead ends", () => {
  const reviewed = /^app\/portal\/(website|technical|local-seo|settings)\//;
  const dead = allCards()
    .filter((c) => reviewed.test(c.file))
    .filter((c) => !/cta=\{/.test(c.block) && !/requirement=/.test(c.block));
  expect(dead).toEqual([]);
});

test("every CTA points at a portal route that exists", () => {
  // A CTA to a missing page is a dead end with extra steps.
  const hrefs = allCards()
    .map((c) => c.block.match(/href:\s*"([^"]+)"/)?.[1])
    .filter((h): h is string => !!h);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) {
    expect(h.startsWith("/portal/")).toBe(true);
    const seg = h.replace(/^\/portal\//, "").replace(/\/$/, "");
    expect(fs.existsSync(`${ROOT}/app/portal/${seg}/page.tsx`)).toBe(true);
  }
});

test("a card cannot be constructed with neither cta nor requirement", () => {
  // The union is what prevents regressions; a plain optional prop would not.
  const src = read("app/portal/_components/ConnectCard.tsx");
  expect(src).toMatch(/type WithCta = Base & \{/);
  expect(src).toMatch(/type WithRequirement = Base & \{/);
  expect(src).toMatch(/export type ConnectCardProps = WithCta \| WithRequirement/);
  // requirement is required in its branch, not optional in a single shape.
  expect(src).toMatch(/requirement: string;/);
});

test("the tag reports the real state instead of always saying Available", () => {
  const src = read("app/portal/_components/ConnectCard.tsx");
  expect(src).toMatch(/const available = !requirement/);
  expect(src).toMatch(/available \? "Available" : "Not yet available"/);
});

test("a card that needs something always shows what", () => {
  const src = read("app/portal/_components/ConnectCard.tsx");
  expect(src).toMatch(/\{requirement && \(/);
  expect(src).toMatch(/className="p-onboard-req"/);
});

test("the misleading always-on Available tag is gone", () => {
  const src = read("app/portal/_components/ConnectCard.tsx");
  expect(src).not.toMatch(/p-onboard-tag">Available</);
});

test("cards that route to a real report keep pointing at one", () => {
  // These three were the concrete dead ends worth naming: each had a report
  // that already existed while the card described it as forthcoming.
  const byTitle = new Map(allCards().map((c) => [c.title, c.block]));
  expect(byTitle.get("Issue breakdown")).toMatch(/href: "\/portal\/technical"/);
  expect(byTitle.get("Sitemap & robots")).toMatch(/href: "\/portal\/technical"/);
  expect(byTitle.get("Size up every local rival")).toMatch(/href: "\/portal\/competitors"/);
});
