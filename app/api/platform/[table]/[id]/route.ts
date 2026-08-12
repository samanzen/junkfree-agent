import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { getBrandById } from "@/lib/brands";
import { publishGbpLocalPost, publishGbpReviewReply } from "@/lib/google/gbp";

// Update the status of a gbp_posts / review_responses / citations row.
// When approving GBP posts or review replies and a Business Profile location
// is connected, also attempt to push the change live to Google.

const ALLOWED = new Set(["gbp_posts", "review_responses", "citations"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { table, id } = await params;
  if (!ALLOWED.has(table)) {
    return NextResponse.json({ error: "bad table" }, { status: 400 });
  }
  const { status } = await req.json().catch(() => ({ status: null }));
  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const { data: row } = await db.from(table).select("*").eq("id", id).single();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  const accessErr = requireBrandAccess(auth, row.brand_id);
  if (accessErr) return accessErr;

  let nextStatus = status as string;
  let publish: { attempted: boolean; ok: boolean; detail?: string } = {
    attempted: false,
    ok: false,
  };

  if (status === "approved" && (table === "gbp_posts" || table === "review_responses")) {
    const brand = await getBrandById(row.brand_id);
    if (brand?.gbp_location_id) {
      publish.attempted = true;
      if (table === "gbp_posts") {
        const result = await publishGbpLocalPost({
          brandId: brand.id,
          locationId: brand.gbp_location_id,
          title: row.title,
          body: row.body,
          cta: row.cta,
        });
        if (result.ok) {
          publish.ok = true;
          nextStatus = "live";
          const livePatch = {
            status: "live",
            remote_name: result.remoteName,
            published_at: new Date().toISOString(),
          };
          let { error: upErr } = await db.from("gbp_posts").update(livePatch).eq("id", id);
          if (upErr && /remote_name|published_at|column/i.test(upErr.message)) {
            // Migration 014 not applied yet — still mark live without extras.
            ({ error: upErr } = await db.from("gbp_posts").update({ status: "live" }).eq("id", id));
          }
          if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
          return NextResponse.json({ ok: true, published: true, remote_name: result.remoteName });
        }
        publish.detail = result.error;
        // Still mark approved locally so the queue clears; surface why Google failed.
      } else if (row.google_review_name) {
        const result = await publishGbpReviewReply({
          brandId: brand.id,
          reviewName: row.google_review_name,
          comment: row.draft_response,
        });
        if (result.ok) {
          publish.ok = true;
          nextStatus = "live";
          await db
            .from("review_responses")
            .update({
              status: "live",
              published_at: new Date().toISOString(),
            })
            .eq("id", id);
          return NextResponse.json({ ok: true, published: true });
        }
        publish.detail = result.error;
      } else {
        publish.detail =
          "Approved locally. Google reply needs a linked review id (import reviews from Business Profile first).";
      }
    }
  }

  const { error } = await db.from(table).update({ status: nextStatus }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    published: publish.ok,
    publish_attempted: publish.attempted,
    publish_detail: publish.detail || null,
  });
}
