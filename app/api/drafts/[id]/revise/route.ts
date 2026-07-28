import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { reviseDraft } from "@/lib/agents";
import type { Brand } from "@/lib/brands";

export const maxDuration = 60;

// Owner feedback -> the agent revises the draft in place and logs the exchange.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { feedback } = await req.json().catch(() => ({ feedback: "" }));
  if (!feedback?.trim()) return NextResponse.json({ error: "feedback required" }, { status: 400 });

  const { data: draft } = await db.from("drafts").select("*").eq("id", id).single();
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: brand } = await db.from("brands").select("*").eq("id", draft.brand_id).single();
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  try {
    const revised = await reviseDraft(brand as Brand, draft.body, feedback);
    if (!revised) throw new Error("empty revision");

    // Log the feedback thread on the draft for history.
    const thread = Array.isArray(draft.feedback) ? draft.feedback : [];
    thread.push({ feedback, at: new Date().toISOString() });

    await db.from("drafts").update({ body: revised, feedback: thread, status: "pending_review" }).eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
