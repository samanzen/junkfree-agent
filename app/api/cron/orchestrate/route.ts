import { NextRequest, NextResponse } from "next/server";
import { runOrchestration } from "@/lib/orchestrator";

export const maxDuration = 300; // allow long agent runs

// GET = triggered by Vercel Cron (see vercel.json). Protected by CRON_SECRET
// so nobody external can spin up billable agent runs.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return run();
}

// POST = triggered by the dashboard's "Run agents now" button. Allowed only
// from the same site (the browser sets sec-fetch-site automatically and it
// can't be forged cross-origin), so no secret needs to live in the browser.
export async function POST(req: NextRequest) {
  const sameSite = req.headers.get("sec-fetch-site");
  if (sameSite && sameSite !== "same-origin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return run();
}

async function run() {
  try {
    const result = await runOrchestration();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
