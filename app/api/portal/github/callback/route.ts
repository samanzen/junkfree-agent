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
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const rawState = url.searchParams.get("state") || "";
  const setupAction = url.searchParams.get("setup_action") || "";
  const installationIdRaw = url.searchParams.get("installation_id") || "";

  const state = verifyGitHubAppState(rawState);
  if (!state) {
    return back(origin, { github: "failed", reason: "invalid_state" });
  }

  if (setupAction === "request") {
    // Org requires admin approval.
    return back(state.origin || origin, {
      github: "pending_approval",
      brand: state.brandId,
    });
  }

  if (!installationIdRaw || !/^\d+$/.test(installationIdRaw)) {
    return back(state.origin || origin, { github: "cancelled", brand: state.brandId });
  }
  const installationId = Number(installationIdRaw);

  const consumed = await consumeAuthAttempt(state.nonce, state.brandId);
  if (!consumed.ok) {
    return back(state.origin || origin, {
      github: "failed",
      reason: consumed.error.includes("already") ? "replay" : "session",
      brand: state.brandId,
    });
  }

  if (consumed.userId !== state.userId) {
    return back(state.origin || origin, { github: "failed", reason: "user_mismatch", brand: state.brandId });
  }

  const installation = await getInstallation(installationId);
  if (!installation.ok) {
    console.error("[github/callback] installation verify failed", installation.status);
    return back(state.origin || origin, { github: "failed", reason: "installation", brand: state.brandId });
  }
  if (installation.suspended) {
    return back(state.origin || origin, { github: "failed", reason: "suspended", brand: state.brandId });
  }

  await attachInstallationToAttempt(state.nonce, installationId);

  // Stash pending install on a transient row keyed by brand (service role).
  await db.from("github_app_pending_installs").upsert({
    brand_id: state.brandId,
    user_id: state.userId,
    installation_id: installationId,
    account_login: installation.accountLogin,
    account_type: installation.accountType,
    account_id: installation.accountId,
    site_url: consumed.siteUrl || state.siteUrl,
    created_at: new Date().toISOString(),
  });

  return back(state.origin || origin, {
    github: "installed",
    brand: state.brandId,
  });
}
