import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const maxDuration = 20;

// DELETE: remove a keyword from tracking (soft delete via status = lost).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await db
    .from("tracked_keywords")
    .update({ status: "lost", last_seen_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
