import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { slugify, splitFrontMatter } from "@/lib/utils";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { queueLivePublishIfConnected } from "@/lib/execution/queue-approved";

// Second Publish click (ExecutionPanel). Prefer the live last-mile path when
// a website is connected — never mark "published" until stepPublish proves it.
// Without a connection, fall back to the in-platform `content` table only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const { data: draft, error } = await db.from("drafts").select("*").eq("id", id).single();
  if (error || !draft) return NextResponse.json({ error: "not found" }, { status: 404 });

  const accessErr = requireBrandAccess(auth, draft.brand_id);
  if (accessErr) return accessErr;

  if (draft.status !== "approved") {
    return NextResponse.json({ error: "approve it first" }, { status: 409 });
  }

  const { data: brand } = await db.from("brands").select("id, name").eq("id", draft.brand_id).single();

  const live = await queueLivePublishIfConnected(
    { id: draft.brand_id, name: brand?.name || "" },
    {
      id: draft.id,
      task_type: draft.task_type,
      title: draft.title,
      body: draft.body,
      target_url: draft.target_url,
      target_keyword: draft.target_keyword,
    }
  );

  if (live.queued) {
    // Stay approved until the publish job verifies the live page.
    return NextResponse.json({ ok: true, status: "approved", live_queued: true });
  }

  // No last-mile writer — promote into the platform content table only.
  if (draft.task_type === "new_blog" || draft.task_type === "new_page" || draft.task_type === "geo_answers") {
    const raw = draft.target_keyword || draft.title.replace(/^(Blog|Page):\s*/i, "");
    const base = slugify(raw);
    const slug =
      draft.task_type === "geo_answers"
        ? "faq"
        : draft.task_type === "new_page"
          ? base
          : `blog/${base}`;
    const { title, body } = splitFrontMatter(draft.body, draft.title);
    const finalTitle =
      draft.task_type === "geo_answers"
        ? `Frequently Asked Questions — ${brand?.name || draft.title}`
        : title;
    await db.from("content").upsert(
      {
        slug,
        brand_id: draft.brand_id,
        title: finalTitle,
        body,
        published_at: new Date().toISOString(),
      },
      { onConflict: "brand_id,slug" }
    );
  }

  await db.from("drafts").update({ status: "published" }).eq("id", id);
  return NextResponse.json({ ok: true, status: "published", live_queued: false });
}
