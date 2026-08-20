// Owner playbook — standing orders the Manager and staff follow.
// Not a vertical E-E-A-T snippet (that lives in lib/playbooks). This is what
// the owner taught the company: who we sell to, what we will not write, and
// how we judge a win. Empty column → a safe default from the brand row.

import { db } from "../supabase";

export type PlaybookBrand = {
  name: string;
  services?: string | null;
  service_area?: string | null;
  voice?: string | null;
  intent_notes?: string | null;
  edge?: string | null;
  owner_playbook?: string | null;
};

export const MAX_PLAYBOOK_CHARS = 4000;
const MAX_CORRECTIONS_KEPT = 12;

/** Default standing orders when the owner has not written a playbook yet. */
export function defaultOwnerPlaybook(brand: PlaybookBrand): string {
  const services = (brand.services || "the listed services").trim();
  const area = (brand.service_area || "the service area").trim();
  const voice = (brand.voice || "direct, trustworthy, professional").trim();
  const intent = (brand.intent_notes || "").trim();
  const edge = (brand.edge || "").trim();

  return [
    `Win searches from people ready to hire ${brand.name} for ${services} in ${area}. Rankings that do not lead to quotes or jobs are not a win.`,
    `Write in this voice: ${voice}.`,
    edge ? `Lead with this edge: ${edge}.` : null,
    intent ? `Never chase these intents: ${intent}.` : "Do not chase 'free' or encyclopedia queries unless the owner says otherwise.",
    "One topic, one URL. Improve the existing page instead of forking a near-duplicate.",
    "Never invent prices, credentials, or local rules we have not been given.",
    "Do not treat a few days of Search Console movement as a lesson. Wait until the page is live and Google has had time.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function resolvedOwnerPlaybook(brand: PlaybookBrand): string {
  const stored = (brand.owner_playbook || "").trim();
  return stored || defaultOwnerPlaybook(brand);
}

export function ownerPlaybookBlock(brand: PlaybookBrand): string {
  return `OWNER PLAYBOOK (standing orders — follow these over generic SEO advice):
${resolvedOwnerPlaybook(brand)}`;
}

/** Append an owner correction. Keeps the default/base text and a short tail of notes. */
export function mergeOwnerCorrection(current: string | null | undefined, correction: string, brand: PlaybookBrand): string {
  const note = correction.replace(/\s+/g, " ").trim();
  if (!note) return resolvedOwnerPlaybook({ ...brand, owner_playbook: current });

  const base = (current || "").trim() || defaultOwnerPlaybook(brand);
  const stamp = new Date().toISOString().slice(0, 10);
  const line = `Owner correction (${stamp}): ${note}`;
  const withoutDup = base
    .split("\n")
    .filter((row) => row.trim().toLowerCase() !== line.toLowerCase());
  const corrections = withoutDup.filter((row) => row.startsWith("Owner correction ("));
  const head = withoutDup.filter((row) => !row.startsWith("Owner correction ("));
  const kept = [...corrections, line].slice(-MAX_CORRECTIONS_KEPT);
  const merged = [...head, ...kept].join("\n").trim();
  return merged.length > MAX_PLAYBOOK_CHARS ? merged.slice(merged.length - MAX_PLAYBOOK_CHARS) : merged;
}

export async function recordOwnerTeaching(brandId: string, correction: string): Promise<void> {
  const note = correction.replace(/\s+/g, " ").trim();
  if (!note) return;

  const { data } = await db
    .from("brands")
    .select("name, services, service_area, voice, intent_notes, edge, owner_playbook")
    .eq("id", brandId)
    .maybeSingle();
  if (!data) return;

  const next = mergeOwnerCorrection(data.owner_playbook, note, data);
  await db.from("brands").update({ owner_playbook: next }).eq("id", brandId);
  await db.from("lessons").insert({
    brand_id: brandId,
    lesson: `Owner teaching: ${note}`.slice(0, 500),
  });
}
