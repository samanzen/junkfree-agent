// Persist / read AI visibility prompt checks. Best-effort: if migration 015
// is not applied, inserts silently no-op so snapshots still store the score.

import { db } from "./supabase";
import type { AiVisibilityCheck } from "./geo-agent";

const MISSING = new Set(["PGRST205", "42P01"]);

export async function persistAiVisibilityChecks(
  brandId: string,
  checks: AiVisibilityCheck[]
): Promise<void> {
  if (!checks.length) return;
  const rows = checks.map((c) => ({
    brand_id: brandId,
    prompt: c.prompt,
    engine: c.engine,
    mentioned: c.mentioned,
    raw_excerpt: c.raw?.slice(0, 1500) || null,
    captured_at: new Date().toISOString(),
  }));
  const { error } = await db.from("ai_visibility_checks").insert(rows);
  if (error && !MISSING.has((error as { code?: string }).code || "")) {
    console.warn("[aiVisibility] persist failed:", error.message);
  }
}

export async function listRecentAiChecks(brandId: string, limit = 40) {
  const { data, error } = await db
    .from("ai_visibility_checks")
    .select("id, prompt, engine, mentioned, captured_at")
    .eq("brand_id", brandId)
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export async function listAiPrompts(brandId: string) {
  const { data, error } = await db
    .from("ai_visibility_prompts")
    .select("id, prompt, active, created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return data || [];
}

export async function upsertAiPrompt(brandId: string, prompt: string) {
  const cleaned = prompt.trim().slice(0, 240);
  if (!cleaned) return { ok: false as const, error: "Enter a prompt to track." };
  const { error } = await db.from("ai_visibility_prompts").upsert(
    { brand_id: brandId, prompt: cleaned, active: true },
    { onConflict: "brand_id,prompt" }
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
