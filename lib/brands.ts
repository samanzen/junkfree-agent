// Multi-tenant brand loader. Brands live in the database (the `brands` table),
// not in code — this is what makes the engine a sellable platform. Each brand
// (Junk Free, POMO BUILD, or a Volo Locals customer) is one row.

import { db } from "./supabase";

export type Brand = {
  id: string;
  slug: string;
  name: string;
  site_url: string;
  gsc_property: string | null;
  gbp_location_id: string | null;
  service_area: string | null;
  services: string | null;
  edge: string | null;
  voice: string | null;
  competitors: string | null;
  intent_notes: string | null;
  auto_publish_meta: boolean;
  active: boolean;
  owner_email: string | null;
};

export async function getActiveBrands(): Promise<Brand[]> {
  const { data, error } = await db.from("brands").select("*").eq("active", true);
  if (error) throw new Error("Could not load brands: " + error.message);
  return (data as Brand[]) || [];
}

export async function getBrand(slug: string): Promise<Brand | null> {
  const { data } = await db.from("brands").select("*").eq("slug", slug).single();
  return (data as Brand) || null;
}

// The business-context block injected into every agent prompt for a brand.
export function brandBlock(b: Brand): string {
  return `BUSINESS CONTEXT — apply throughout:
- Name: ${b.name}
- Service area: ${b.service_area || "n/a"}
- Services: ${b.services || "n/a"}
- Edge: ${b.edge || "n/a"}
- Voice: ${b.voice || "Direct, trustworthy, local. Canadian spelling."}
- Website: ${b.site_url}${
    b.competitors ? `\n- Competitors to beat: ${b.competitors}` : ""
  }${
    b.intent_notes ? `\n- SEARCH-INTENT NOTE: ${b.intent_notes}` : ""
  }`;
}
