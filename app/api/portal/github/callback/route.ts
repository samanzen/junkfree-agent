import { NextRequest, NextResponse } from "next/server";
import {
  verifyGitHubAppState,
  consumeAuthAttempt,
  attachInstallationToAttempt,
  getInstallation,
} from "@/lib/github-app";
import { db } from "@/lib/supabase";

export const maxDuration = 60;

function back(origin: string, params: Record<string, string>): NextResponse {
  const url = new URL("/portal/settings", origin);
  url.searchParams.set("tab", "connections");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url.toString());
}

/**
 * GitHub App Setup URL callback.
 * Public GET — trust comes from signed state + one-time nonce consumption.
 * Validates installation via GitHub App API (never trusts installation_id alone).
 * Must never throw a bare 500 to the browser — always redirect with a reason.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;

  try {
    const rawState = url.searchParams.get("state") || "";
    const setupAction = url.searchParams.get("setup_action") || "";
    const installationIdRaw = url.searchParams.get("installation_id") || "";

    const state = verifyGitHubAppState(rawState);
    if (!state) {
      return back(origin, { github: "failed", reason: "invalid_state" });
    }

    const dest = state.origin || origin;

    if (setupAction === "request") {
      return back(dest, {
        github: "pending_approval",
        brand: state.brandId,
      });
    }

    if (!installationIdRaw || !/^\d+$/.test(installationIdRaw)) {
      return back(dest, { github: "cancelled", brand: state.brandId });
    }
    const installationId = Number(installationIdRaw);

    const consumed = await consumeAuthAttempt(state.nonce, state.brandId);
    if (!consumed.ok) {
      const reason = /already used/i.test(consumed.error)
        ? "replay"
        : /not found|Could not|relation|schema/i.test(consumed.error)
          ? "session"
          : "session";
      console.error("[github/callback] auth attempt", consumed.error);
      return back(dest, {
        github: "failed",
        reason,
        brand: state.brandId,
      });
    }

    if (consumed.userId !== state.userId) {
      return back(dest, { github: "failed", reason: "user_mismatch", brand: state.brandId });
    }

    const installation = await getInstallation(installationId);
    if (!installation.ok) {
      console.error("[github/callback] installation verify failed", installation.error, installation.status);
      return back(dest, { github: "failed", reason: "installation", brand: state.brandId });
    }
    if (installation.suspended) {
      return back(dest, { github: "failed", reason: "suspended", brand: state.brandId });
    }

    await attachInstallationToAttempt(state.nonce, installationId);

    const { error: pendingErr } = await db.from("github_app_pending_installs").upsert({
      brand_id: state.brandId,
      user_id: state.userId,
      installation_id: installationId,
      account_login: installation.accountLogin,
      account_type: installation.accountType,
      account_id: installation.accountId,
      site_url: consumed.siteUrl || state.siteUrl,
      created_at: new Date().toISOString(),
    });
    if (pendingErr) {
      console.error("[github/callback] pending install upsert failed", pendingErr.message);
      return back(dest, {
        github: "failed",
        reason: "db",
        brand: state.brandId,
      });
    }

    return back(dest, {
      github: "installed",
      brand: state.brandId,
    });
  } catch (e) {
    console.error(
      "[github/callback] unexpected error",
      e instanceof Error ? e.message : "unknown"
    );
    return back(origin, { github: "failed", reason: "error" });
  }
}
