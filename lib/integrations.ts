// PER-BRAND INTEGRATION CREDENTIALS (Sprint 6.1 foundation) -- provider-
// agnostic storage for future third-party integrations (GA4, HighLevel,
// Stripe, QuickBooks, Jobber, and anything added later). No provider is
// implemented yet; this is the shared plumbing every future provider
// integration will read/write through.
//
// Service-role only, by construction: this file only ever uses `db` from
// ./supabase (the service-role client), the backing table has RLS enabled
// with no policies (see supabase/006_brand_integrations.sql), and nothing
// here is exported to, or callable from, client components.
//
// Existing global env-var integrations (GSC, DataForSEO, Anthropic, Gemini)
// are untouched by this file and keep working exactly as before -- this is
// purely additive infrastructure for integrations that don't exist yet.

import { db } from "./supabase";
import { encryptCredentials, decryptCredentials } from "./crypto";

// Known providers today. The `provider` column itself is plain text (see
// migration comments) specifically so a future provider can be added with
// just a new string value here -- no migration required.
// "wordpress" and "webhook" are the first providers that are actually
// implemented (lib/execution/adapters/*). The rest remain declared-but-unbuilt.
// The column is plain text by design, so adding these needs no migration.
export type IntegrationProvider =
  | "ga4" | "highlevel" | "stripe" | "quickbooks" | "jobber"
  | "wordpress" | "webhook"
  // One row per brand holds EVERY linked Google account and every Google
  // product selection (see lib/google/store.ts). Deliberately not one provider
  // per Google product: the table is unique on (brand_id, provider), and a
  // single shared identity is what lets Search Console, Analytics and Business
  // Profile reuse one sign-in rather than asking the customer three times.
  // "ga4" above predates this and is unused.
  | "google";

export type IntegrationStatus = "disconnected" | "connected" | "error" | "expired";

// The integration status model: what the rest of the app (a future settings
// UI, health checks, etc.) can know about a brand's integration WITHOUT ever
// touching the encrypted credential blob.
export type BrandIntegration = {
  id: string;
  brand_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  metadata: Record<string, unknown>;
  last_connected_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

// Columns returned by every "generic" read below. Deliberately excludes
// credentials_encrypted -- the only path to decrypted credentials is
// getDecryptedCredentials(), never a side effect of listing/reading status.
const STATUS_COLUMNS =
  "id, brand_id, provider, status, metadata, last_connected_at, last_error, created_at, updated_at";

// All integrations configured for a brand (connected or not), for a future
// settings/status view. Never includes secrets.
export async function listIntegrations(brandId: string): Promise<BrandIntegration[]> {
  const { data, error } = await db
    .from("brand_integrations")
    .select(STATUS_COLUMNS)
    .eq("brand_id", brandId)
    .order("provider", { ascending: true });
  if (error) throw new Error("Could not load integrations: " + error.message);
  return (data as BrandIntegration[]) || [];
}

// A single brand+provider's status row, or null if never configured. Never
// includes secrets.
export async function getIntegration(
  brandId: string,
  provider: IntegrationProvider
): Promise<BrandIntegration | null> {
  const { data } = await db
    .from("brand_integrations")
    .select(STATUS_COLUMNS)
    .eq("brand_id", brandId)
    .eq("provider", provider)
    .maybeSingle();
  return (data as BrandIntegration) || null;
}

/**
 * First connected integration among `providers`, or null. Tolerant by design:
 * returns null on ANY database error (including the "permission denied" the
 * brand_integrations grant bug produces) instead of throwing, so a brand with
 * no publishing configured behaves identically to one whose table is
 * unreachable -- neither should break an unrelated request. Callers that need
 * to distinguish those two cases use integrationsReachable() below.
 */
export async function findConnectedIntegration(
  brandId: string,
  providers: IntegrationProvider[]
): Promise<BrandIntegration | null> {
  if (!providers.length) return null;
  const { data, error } = await db
    .from("brand_integrations")
    .select(STATUS_COLUMNS)
    .eq("brand_id", brandId)
    .eq("status", "connected")
    .in("provider", providers)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) return null;
  return ((data as BrandIntegration[]) || [])[0] || null;
}

/**
 * Whether brand_integrations can actually be read. Exists because migration
 * 006 created the table and enabled RLS but never granted service_role, so an
 * unreachable table is a real, observed production state that must be
 * reportable rather than silently indistinguishable from "not configured".
 */
export async function integrationsReachable(): Promise<{ ok: boolean; reason: string | null }> {
  const { error } = await db.from("brand_integrations").select("id").limit(1);
  if (!error) return { ok: true, reason: null };
  return { ok: false, reason: `${error.code || "error"}: ${error.message}` };
}

// Encrypts and stores credentials for a brand+provider, marking it
// 'connected'. Upserts on (brand_id, provider) -- calling this again simply
// rotates the stored credential. `metadata` is non-secret and stored
// alongside in the clear (e.g. a GA4 property id, a HighLevel location id).
export async function upsertIntegrationCredentials(
  brandId: string,
  provider: IntegrationProvider,
  credentials: Record<string, string>,
  metadata: Record<string, unknown> = {}
): Promise<BrandIntegration> {
  const credentials_encrypted = encryptCredentials(credentials);
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("brand_integrations")
    .upsert(
      {
        brand_id: brandId,
        provider,
        credentials_encrypted,
        metadata,
        status: "connected",
        last_connected_at: now,
        last_error: null,
        updated_at: now,
      },
      { onConflict: "brand_id,provider" }
    )
    .select(STATUS_COLUMNS)
    .single();

  if (error) throw new Error("Could not store integration credentials: " + error.message);
  return data as BrandIntegration;
}

// Decrypts and returns the stored credentials for a brand+provider, or null
// if none are configured. This is the ONLY function in the codebase that
// ever returns plaintext secret material -- callers must be server-side
// provider clients (added in future sprints), never a route that echoes the
// result back to a browser.
export async function getDecryptedCredentials(
  brandId: string,
  provider: IntegrationProvider
): Promise<Record<string, string> | null> {
  const { data } = await db
    .from("brand_integrations")
    .select("credentials_encrypted")
    .eq("brand_id", brandId)
    .eq("provider", provider)
    .maybeSingle();

  if (!data?.credentials_encrypted) return null;
  return decryptCredentials(data.credentials_encrypted as string);
}

// Clears stored credentials and marks the integration disconnected. Keeps
// the row (and its history/metadata) rather than deleting it, so
// re-connecting is just another upsertIntegrationCredentials() call.
export async function disconnectIntegration(brandId: string, provider: IntegrationProvider): Promise<void> {
  const { error } = await db
    .from("brand_integrations")
    .update({
      status: "disconnected",
      credentials_encrypted: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("brand_id", brandId)
    .eq("provider", provider);
  if (error) throw new Error("Could not disconnect integration: " + error.message);
}

// Records a failure against an existing integration (e.g. a future
// provider's token refresh or API call fails) without touching its stored
// credentials -- lets a settings UI surface "this needs attention" instead
// of silently failing.
export async function markIntegrationError(
  brandId: string,
  provider: IntegrationProvider,
  errorMessage: string
): Promise<void> {
  const { error } = await db
    .from("brand_integrations")
    .update({ status: "error", last_error: errorMessage, updated_at: new Date().toISOString() })
    .eq("brand_id", brandId)
    .eq("provider", provider);
  if (error) throw new Error("Could not record integration error: " + error.message);
}
