import { db } from "../supabase";

/** CSRF / replay protection for GitHub App install attempts. */

export async function createAuthAttempt(opts: {
  nonce: string;
  brandId: string;
  userId: string;
  origin: string;
  siteUrl: string | null;
}): Promise<void> {
  await db.from("github_app_auth_attempts").upsert({
    nonce: opts.nonce,
    brand_id: opts.brandId,
    user_id: opts.userId,
    origin: opts.origin,
    site_url: opts.siteUrl,
    created_at: new Date().toISOString(),
    consumed_at: null,
    installation_id: null,
  });
}

export async function consumeAuthAttempt(
  nonce: string,
  brandId: string
): Promise<{ ok: true; siteUrl: string | null; origin: string; userId: string } | { ok: false; error: string }> {
  const { data, error } = await db
    .from("github_app_auth_attempts")
    .select("nonce, brand_id, user_id, origin, site_url, consumed_at, created_at")
    .eq("nonce", nonce)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Authorization session not found." };
  if (data.brand_id !== brandId) return { ok: false, error: "Brand mismatch." };
  if (data.consumed_at) return { ok: false, error: "Authorization session already used." };
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (ageMs > 20 * 60 * 1000) return { ok: false, error: "Authorization session expired." };

  const { error: updErr } = await db
    .from("github_app_auth_attempts")
    .update({ consumed_at: new Date().toISOString() })
    .eq("nonce", nonce)
    .is("consumed_at", null);
  if (updErr) return { ok: false, error: "Could not finalize authorization session." };

  return {
    ok: true,
    siteUrl: data.site_url || null,
    origin: data.origin,
    userId: data.user_id,
  };
}

export async function attachInstallationToAttempt(nonce: string, installationId: number): Promise<void> {
  await db
    .from("github_app_auth_attempts")
    .update({ installation_id: installationId })
    .eq("nonce", nonce);
}
