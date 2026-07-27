import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getBrand } from "@/lib/brands";
import { writeContent } from "@/lib/agents";

export const maxDuration = 60;

// The 16 original short blog posts (slug + primary keyword). The engine rewrites
// each into a deep, E-E-A-T post and republishes it to the SAME URL, so no SEO
// value is lost. Processes ONE per call (stays under the 60s limit).
const EXISTING: { slug: string; keyword: string }[] = [
  { slug: "complete-guide-junk-removal-vancouver", keyword: "junk removal Vancouver" },
  { slug: "how-to-prepare-your-home-for-junk-removal", keyword: "how to prepare for junk removal" },
  { slug: "benefits-of-eco-friendly-junk-removal", keyword: "eco-friendly junk removal Vancouver" },
  { slug: "junk-removal-survey-2024", keyword: "junk removal statistics Vancouver" },
  { slug: "mattress-removal-service", keyword: "mattress removal Vancouver" },
  { slug: "cheap-junk-removal-affordable-solutions", keyword: "affordable junk removal Vancouver" },
  { slug: "vancouver-rubbish-removal", keyword: "Vancouver rubbish removal" },
  { slug: "burnaby-junk-removal", keyword: "Burnaby junk removal" },
  { slug: "furniture-disposal-vancouver", keyword: "furniture disposal Vancouver" },
  { slug: "north-vancouver-junk-removal", keyword: "North Vancouver junk removal" },
  { slug: "junk-removal-burnaby", keyword: "junk removal Burnaby" },
  { slug: "vancouver-bc-junk-removal", keyword: "Vancouver BC junk removal" },
  { slug: "large-item-pickup-vancouver", keyword: "large item pickup Vancouver" },
  { slug: "waste-removal-vancouver", keyword: "waste removal Vancouver" },
  { slug: "vancouver-appliance-disposal", keyword: "appliance disposal Vancouver" },
  { slug: "vancouver-junk-disposal", keyword: "Vancouver junk disposal" },
];

export async function POST() {
  const brand = await getBrand("junkfree");
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  // Find the first existing post not yet rewritten (no published content row yet).
  const { data: done } = await db
    .from("content")
    .select("slug")
    .like("slug", "blog/%");
  const doneSet = new Set((done || []).map((r: { slug: string }) => r.slug));

  const next = EXISTING.find((p) => !doneSet.has(`blog/${p.slug}`));
  if (!next) return NextResponse.json({ done: true });

  const raw = await writeContent(brand, next.keyword, "Blog post");
  const { title, body } = splitFront(raw);

  await db.from("content").upsert({
    slug: `blog/${next.slug}`,
    brand_id: brand.id,
    task_type: "new_blog",
    title,
    body,
    published_at: new Date().toISOString(),
  });

  const remaining = EXISTING.filter((p) => !doneSet.has(`blog/${p.slug}`)).length - 1;
  return NextResponse.json({ done: false, rewrote: next.slug, remaining });
}

function splitFront(body: string) {
  let title = "";
  const kept: string[] = [];
  for (const line of body.split("\n")) {
    const t = line.match(/^\s*TITLE TAG:\s*(.+)$/i);
    if (t) { title = t[1].trim(); continue; }
    if (/^\s*META:\s*/i.test(line)) continue;
    kept.push(line);
  }
  return { title: title || "Junk Removal Guide", body: kept.join("\n").trim() };
}
