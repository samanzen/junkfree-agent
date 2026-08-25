import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/supabase";
import { disconnectGitHubApp, getGitHubAppConnection } from "@/lib/github-app";

export const maxDuration = 30;

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = signatureHeader.slice("sha256=".length);
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GitHub App webhooks — keep connection state in sync.
 * Never logs payload secrets.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifySignature(raw, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event") || "";
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const installation = body.installation as { id?: number } | undefined;
  const installationId = Number(installation?.id || 0);

  if (event === "installation" && body.action === "deleted" && installationId) {
    const { data: rows } = await db
      .from("brand_integrations")
      .select("brand_id, metadata")
      .eq("provider", "github")
      .eq("status", "connected");
    for (const row of rows || []) {
      const meta = (row.metadata || {}) as { authType?: string; installationId?: number };
      if (meta.authType === "github_app" && Number(meta.installationId) === installationId) {
        await disconnectGitHubApp(row.brand_id);
      }
    }
    await db.from("github_app_pending_installs").delete().eq("installation_id", installationId);
  }

  if (event === "installation_repositories" && installationId) {
    // Access changed — mark integrations that lost the selected repo.
    const removed = (body.repositories_removed as { id?: number }[] | undefined) || [];
    const removedIds = new Set(removed.map((r) => Number(r.id)).filter(Boolean));
    if (removedIds.size) {
      const { data: rows } = await db
        .from("brand_integrations")
        .select("brand_id, metadata")
        .eq("provider", "github")
        .eq("status", "connected");
      for (const row of rows || []) {
        const meta = (row.metadata || {}) as { authType?: string; installationId?: number; repoId?: number };
        if (
          meta.authType === "github_app" &&
          Number(meta.installationId) === installationId &&
          removedIds.has(Number(meta.repoId))
        ) {
          await disconnectGitHubApp(row.brand_id);
        }
      }
    }
  }

  if (event === "installation" && body.action === "suspend" && installationId) {
    const { data: rows } = await db
      .from("brand_integrations")
      .select("brand_id, metadata")
      .eq("provider", "github")
      .eq("status", "connected");
    for (const row of rows || []) {
      const meta = (row.metadata || {}) as { authType?: string; installationId?: number };
      if (meta.authType === "github_app" && Number(meta.installationId) === installationId) {
        await db
          .from("brand_integrations")
          .update({
            status: "error",
            last_error: "GitHub App installation suspended.",
            updated_at: new Date().toISOString(),
          })
          .eq("brand_id", row.brand_id)
          .eq("provider", "github");
      }
    }
  }

  if (event === "installation" && body.action === "unsuspend" && installationId) {
    const { data: rows } = await db
      .from("brand_integrations")
      .select("brand_id, metadata, last_error")
      .eq("provider", "github")
      .eq("status", "error");
    for (const row of rows || []) {
      const meta = (row.metadata || {}) as { authType?: string; installationId?: number };
      if (meta.authType === "github_app" && Number(meta.installationId) === installationId) {
        await db
          .from("brand_integrations")
          .update({
            status: "connected",
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("brand_id", row.brand_id)
          .eq("provider", "github");
      }
    }
  }

  void getGitHubAppConnection;
  return NextResponse.json({ ok: true });
}
