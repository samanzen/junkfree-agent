import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export async function GET() {
  const { data } = await db
    .from("drafts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json(data || []);
}
