import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getBrandById } from "@/lib/brands";
import { generatePostImages } from "@/lib/images";
import { requireAuth, isAuthError } from "@/lib/auth";

export const maxDuration = 60;

// Adds AI images to ONE image-less new_page/new_blog draft per call, so each
// invocation stays well under the 60s Hobby limit. The dashboard calls this
// repeatedly until { done: true }.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  // Find the newest content draft that has no image yet.
  const { data: drafts } = await db
    .from("drafts")
    .select("*")
    .in("task_type", ["new_blog", "new_page"])
    .in("status", ["pending_review", "approved"])
    .order("created_at", { ascending: false })
    .limit(20);

  const target = (drafts || []).find((d) => !String(d.body).includes("![header]"));
  if (!target) return NextResponse.json({ done: true });

  // COST CAP: at most 1 image-post per day across all brands. Counts drafts that
  // already have an image and were created today.
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const { data: todays } = await db
    .from("drafts")
    .select("body,created_at")
    .gte("created_at", startOfDay.toISOString());
  const doneToday = (todays || []).filter((d) => String(d.body).includes("![header](http")).length;
  if (doneToday >= 1) return NextResponse.json({ done: true, capped: true });

  const brand = await getBrandById(target.brand_id).catch(() => null);
  if (!brand) return NextResponse.json({ done: true });

  const topic = (target.target_keyword || target.title || "local service").replace(/^(Blog|Page):\s*/, "");
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

  const imgs = await generatePostImages(brand as unknown as import('@/lib/brands').Brand, topic, slug).catch(() => ({ header: null, body: null }));
  let body = target.body as string;
  if (imgs.body) {
    const idx = body.indexOf("\n## ", 200);
    if (idx > -1) body = body.slice(0, idx) + `\n\n![illustration](${imgs.body})\n` + body.slice(idx);
  }
  if (imgs.header) body = `![header](${imgs.header})\n\n` + body;
  else body = `![header](pending)\n\n` + body; // mark as processed even if gen failed, avoids loops

  await db.from("drafts").update({ body }).eq("id", target.id);
  return NextResponse.json({ done: false, processed: target.id });
}


