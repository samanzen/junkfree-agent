import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// One call feeds the whole dashboard: brands + their drafts, GBP posts,
// citations, and review responses. Keeps the UI simple and fast.
export async function GET() {
  const [brands, drafts, gbp, citations, reviews] = await Promise.all([
    db.from("brands").select("*").eq("active", true).order("name"),
    db.from("drafts").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("gbp_posts").select("*").order("created_at", { ascending: false }).limit(50),
    db.from("citations").select("*").order("priority", { ascending: false }).limit(100),
    db.from("review_responses").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  return NextResponse.json({
    brands: brands.data || [],
    drafts: drafts.data || [],
    gbp: gbp.data || [],
    citations: citations.data || [],
    reviews: reviews.data || [],
  });
}
