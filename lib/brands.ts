// Multi-tenant brand loader. Brands live in the database (the `brands` table),
// not in code — this is what makes the engine a sellable platform. Each brand
// (Junk Free, POMO BUILD, or a Volo Locals customer) is one row.

import { db } from "./supabase";

// Vertical classification (Sprint 6.2). Free text at the DB layer (see
// supabase/007_business_model.sql), same convention as IntegrationProvider
// in lib/integrations.ts -- this union is the source of truth for which
// values the application currently understands.
export type BusinessModel =
  | "local_service"
  | "ecommerce"
  | "saas"
  | "national_brand"
  | "content_publisher";

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
  business_model: BusinessModel;
  dataforseo_location_code: number | null;
  dataforseo_language_code: string;
};

// Single source of truth for "does this brand get local-only pipeline work
// (GBP posts, citations) and local-flavored prompts/discovery queries."
// Everything added in Sprint 6.2 that needs to branch on vertical reads
// this instead of comparing business_model directly.
export function isLocalBusiness(brand: Brand): boolean {
  return brand.business_model === "local_service";
}

export async function getActiveBrands(): Promise<Brand[]> {
  const { data, error } = await db.from("brands").select("*").eq("active", true);
  if (error) throw new Error("Could not load brands: " + error.message);
  return (data as Brand[]) || [];
}

export async function getBrand(slug: string): Promise<Brand | null> {
  const { data } = await db.from("brands").select("*").eq("slug", slug).single();
  return (data as Brand) || null;
}

/** Look up a brand by its UUID primary key. Used by job dispatchers. */
export async function getBrandById(id: string): Promise<Brand | null> {
  const { data } = await db.from("brands").select("*").eq("id", id).single();
  return (data as Brand) || null;
}

// The business-context block injected into every agent prompt for a brand.
export function brandBlock(b: Brand): string {
  return `BUSINESS CONTEXT — apply throughout:
- Name: ${b.name}
- Service area: ${b.service_area || "n/a"}
- Services: ${b.services || "n/a"}
- Edge: ${b.edge || "n/a"}
- Voice: ${b.voice || "Direct, trustworthy, professional."}
- Website: ${b.site_url}${
    b.competitors ? `\n- Competitors to beat: ${b.competitors}` : ""
  }${
    b.intent_notes ? `\n- SEARCH-INTENT NOTE: ${b.intent_notes}` : ""
  }`;
}
