import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Human gate. Approving a blog/page draft ALSO publishes it (one click):
// it's promoted into the `content` table that the live site reads from.
// Meta / GEO / intent drafts are just marked approved (you apply those yourself).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dismiss = new URL(req.url).searchParams.get("action") === "dismiss";

  if (dismiss) {
    await db.from("drafts").update({ status: "dismissed" }).eq("id", id);
    return NextResponse.json({ ok: true, status: "dismissed" });
  }

  const { data: draft } = await db.from("drafts").select("*").eq("id", id).single();
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Blog/page content goes live on approve.
  if (draft.task_type === "new_blog" || draft.task_type === "new_page") {
    const raw = draft.target_keyword || draft.title.replace(/^(Blog|Page):\s*/i, "");
    const base = slugify(raw);
    const slug = draft.task_type === "new_blog" ? `blog/${base}` : base;
    const { title, meta, body } = splitFrontMatter(draft.body, draft.title);

    const { error: pubErr } = await db.from("content").upsert({
      slug,
      brand_id: draft.brand_id,
      title,
      body,          // markdown; the site renders it
      published_at: new Date().toISOString(),
    });
    if (pubErr) {
      return NextResponse.json({ ok: false, error: "Publish failed: " + pubErr.message }, { status: 500 });
    }
    await db.from("drafts").update({ status: "published" }).eq("id", id);
    return NextResponse.json({ ok: true, status: "published", slug, meta });
  }

  await db.from("drafts").update({ status: "approved" }).eq("id", id);
  return NextResponse.json({ ok: true, status: "approved" });
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

// Pull "TITLE TAG:" and "META:" lines off the top; return them + the clean body.
function splitFrontMatter(body: string, fallbackTitle: string) {
  let title = fallbackTitle.replace(/^(Blog|Page):\s*/i, "");
  let meta = "";
  const lines = body.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.match(/^\s*TITLE TAG:\s*(.+)$/i);
    const m = line.match(/^\s*META:\s*(.+)$/i);
    if (t) { title = t[1].trim(); continue; }
    if (m) { meta = m[1].trim(); continue; }
    kept.push(line);
  }
  return { title, meta, body: kept.join("\n").trim() };
}
