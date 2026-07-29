import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Feeds the admin dashboard. Accepts an optional ?brand=<uuid> query param
// for server-side filtering — used by the customer portal to load only one
// brand's data instead of all brands.
export async function GET(req: NextRequest) {
  const brandFilter = new URL(req.url).searchParams.get("brand") || null;

  const brandsQuery = db.from("brands").select("*").eq("active", true).order("name");
  const draftsQuery = db.from("drafts").select("*").order("created_at", { ascending: false }).limit(100);
  const gbpQuery = db.from("gbp_posts").select("*").order("created_at", { ascending: false }).limit(50);
  const citesQuery = db.from("citations").select("*").order("priority", { ascending: false }).limit(100);
  const reviewsQuery = db.from("review_responses").select("*").order("created_at", { ascending: false }).limit(50);

  // Apply brand filter server-side when requested.
  const [brands, drafts, gbp, citations, reviews] = await Promise.all([
    brandFilter ? brandsQuery.eq("id", brandFilter) : brandsQuery,
    brandFilter ? draftsQuery.eq("brand_id", brandFilter) : draftsQuery,
    brandFilter ? gbpQuery.eq("brand_id", brandFilter) : gbpQuery,
    brandFilter ? citesQuery.eq("brand_id", brandFilter) : citesQuery,
    brandFilter ? reviewsQuery.eq("brand_id", brandFilter) : reviewsQuery,
  ]);

  return NextResponse.json({
    brands: brands.data || [],
    drafts: drafts.data || [],
    gbp: gbp.data || [],
    citations: citations.data || [],
    reviews: reviews.data || [],
  });
}
