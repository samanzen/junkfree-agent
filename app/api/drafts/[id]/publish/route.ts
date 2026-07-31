import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

// Publish an approved draft. In the rebuilt Next.js site, published content is
// read from the `content` table and rendered at its route — so "publish" just
// promotes the draft into that table and marks it live.
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
  await db.from("content").upsert({
    slug: draft.target_url || draft.target_keyword,
    task_type: draft.task_type,
    title: draft.title,
    body: draft.body,
    published_at: new Date().toISOString(),
  });
  await db.from("drafts").update({ status: "published" }).eq("id", id);
  return NextResponse.json({ ok: true });
}
