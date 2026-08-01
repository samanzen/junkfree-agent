import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { slugify, splitFrontMatter } from "@/lib/utils";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

// Human gate. Approving a blog/page/GEO draft publishes it into the `content`
// table that the live site reads from. Meta/intent drafts are just marked approved.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const dismiss = new URL(req.url).searchParams.get("action") === "dismiss";

  const { data: draft } = await db.from("drafts").select("*").eq("id", id).single();
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });

  const accessErr = requireBrandAccess(auth, draft.brand_id);
  if (accessErr) return accessErr;

  if (dismiss) {
    await db.from("drafts").update({ status: "dismissed" }).eq("id", id);
    return NextResponse.json({ ok: true, status: "dismissed" });
  }

  // Look up the brand so we can use its real name (not a hardcoded string).
  const { data: brand } = await db.from("brands").select("id, name").eq("id", draft.brand_id).single();

  if (draft.task_type === "new_blog" || draft.task_type === "new_page" || draft.task_type === "geo_answers") {
    const raw = draft.target_keyword || draft.title.replace(/^(Blog|Page):\s*/i, "");
    const base = slugify(raw);
    const slug =
      draft.task_type === "geo_answers"
        ? "faq"
        : draft.task_type === "new_page"
        ? base
        : `blog/${base}`;

    const { title, meta, body } = splitFrontMatter(draft.body, draft.title);

    // For GEO FAQ content, use a brand-aware title instead of a hardcoded one.
    const finalTitle =
      draft.task_type === "geo_answers"
        ? `Frequently Asked Questions — ${brand?.name || draft.title}`
        : title;

    const { error: pubErr } = await db.from("content").upsert(
      {
        slug,
        brand_id: draft.brand_id,
        title: finalTitle,
        body,
        published_at: new Date().toISOString(),
      },
      { onConflict: "brand_id,slug" }
    );
    if (pubErr) {
      return NextResponse.json({ ok: false, error: "Publish failed: " + pubErr.message }, { status: 500 });
    }
    await db.from("drafts").update({ status: "published" }).eq("id", id);
    return NextResponse.json({ ok: true, status: "published", slug, meta });
  }

  await db.from("drafts").update({ status: "approved" }).eq("id", id);
  return NextResponse.json({ ok: true, status: "approved" });
}
