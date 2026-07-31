import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 30;

// Toggle a brand's publishing mode. auto_publish_meta=true => Auto mode:
// content publishes without review. false => Review mode (drafts wait).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const accessErr = requireBrandAccess(auth, id);
  if (accessErr) return accessErr;

  const { auto_publish_meta } = await req.json().catch(() => ({}));
  await db.from("brands").update({ auto_publish_meta: !!auto_publish_meta }).eq("id", id);
  return NextResponse.json({ ok: true });
}
