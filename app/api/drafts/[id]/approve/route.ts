import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Human gate: approve a queued draft (or dismiss it via ?action=dismiss).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const action = new URL(req.url).searchParams.get("action") === "dismiss" ? "dismissed" : "approved";
  const { error } = await db.from("drafts").update({ status: action }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: action });
}
