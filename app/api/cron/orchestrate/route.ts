import { NextRequest, NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { enqueue, clearStale } from "@/lib/queue";

export const maxDuration = 60;

// Daily cron trigger (Vercel Cron: 0 9 * * *).
// Now uses the same job-queue path as the dashboard "Run agents" button,
// ensuring identical behaviour for both manual and scheduled runs.
//
// GET = Vercel Cron (authenticated via Authorization header with CRON_SECRET).
// POST = dashboard "Run agents now" button (same-origin, no secret needed).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runQueue();
}

export async function POST(req: NextRequest) {
  const sameSite = req.headers.get("sec-fetch-site");
  if (sameSite && sameSite !== "same-origin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runQueue();
}

async function runQueue() {
  await clearStale();
  const brands = await getActiveBrands();
  if (!brands.length) {
    return NextResponse.json({ error: "No active brands." }, { status: 400 });
  }
  for (const b of brands) await enqueue(b.id, "plan");
  return NextResponse.json({ ok: true, queued: brands.length });
}
