import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { slugify, splitFrontMatter } from "@/lib/utils";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enqueue } from "@/lib/queue";
import { processOneJob } from "@/lib/runner";
import { resolvePublishTarget } from "@/lib/execution/engine";
import { toSiteChange, type DraftLike } from "@/lib/execution/changes";
import { supports } from "@/lib/execution/types";
import { getBrandById } from "@/lib/brands";

// Human gate. Approving a blog/page/GEO draft:
//   1. Records it in the platform `content` table (always, when applicable)
//   2. If a live publishing adapter is connected and the draft is publishable,
//      enqueues a `publish` job and attempts one drain so WordPress/webhook
//      usually updates in the same click — not only the internal CMS.
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

  const brand = await getBrandById(draft.brand_id);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  let slug: string | null = null;
  let meta: string | null = null;

  if (draft.task_type === "new_blog" || draft.task_type === "new_page" || draft.task_type === "geo_answers") {
    const raw = draft.target_keyword || draft.title.replace(/^(Blog|Page):\s*/i, "");
    const base = slugify(raw);
    slug =
      draft.task_type === "geo_answers"
        ? "faq"
        : draft.task_type === "new_page"
        ? base
        : `blog/${base}`;

    const split = splitFrontMatter(draft.body, draft.title);
    meta = split.meta;
    const finalTitle =
      draft.task_type === "geo_answers"
        ? `Frequently Asked Questions — ${brand.name || draft.title}`
        : split.title;

    const { error: pubErr } = await db.from("content").upsert(
      {
        slug,
        brand_id: draft.brand_id,
        title: finalTitle,
        body: split.body,
        published_at: new Date().toISOString(),
      },
      { onConflict: "brand_id,slug" }
    );
    if (pubErr) {
      return NextResponse.json({ ok: false, error: "Publish failed: " + pubErr.message }, { status: 500 });
    }
    await db.from("drafts").update({ status: "published" }).eq("id", id);
  } else {
    await db.from("drafts").update({ status: "approved" }).eq("id", id);
  }

  // ── Live site dispatch (additive; never fails the approval itself) ────────
  // Internal approval already succeeded. Live publish is best-effort: if the
  // adapter is missing or the draft is not a page change, we report that
  // honestly instead of pretending the customer's WordPress updated.
  let live: {
    status: "queued" | "published" | "not_configured" | "not_publishable" | "unsupported" | "failed";
    platform?: string;
    message?: string;
    url?: string | null;
  } = { status: "not_configured" };

  try {
    const translation = toSiteChange(draft as DraftLike, brand.name);
    if (!translation.publishable) {
      live = { status: "not_publishable", message: translation.reason };
    } else {
      const target = await resolvePublishTarget(brand.id);
      if (!target.ok) {
        live = {
          status: "not_configured",
          message: "Approved in your workspace. Connect WordPress (or a webhook) in Settings to publish to your live site.",
        };
      } else if (!supports(target.adapter, translation.change)) {
        live = {
          status: "unsupported",
          platform: target.platform,
          message: `${target.adapter.label} cannot apply this kind of change yet.`,
        };
      } else {
        await enqueue(brand.id, "publish", { draftId: id });
        // One drain attempt so the common case completes without waiting for cron.
        const step = await processOneJob(brand.id);
        if (step.error) {
          live = {
            status: "failed",
            platform: target.platform,
            message: step.error,
          };
        } else if (step.kind === "publish") {
          live = {
            status: "published",
            platform: target.platform,
            message: `Published to ${target.adapter.label}.`,
          };
        } else {
          live = {
            status: "queued",
            platform: target.platform,
            message: `Queued for ${target.adapter.label}. It will go live shortly.`,
          };
        }
      }
    }
  } catch (e) {
    live = {
      status: "failed",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json({
    ok: true,
    status: slug ? "published" : "approved",
    slug,
    meta,
    live,
  });
}
