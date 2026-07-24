import { NextRequest, NextResponse } from "next/server";
import { runOrchestration } from "@/lib/orchestrator";

export const maxDuration = 300; // allow long agent runs (Pro/Enterprise plan)

// Triggered by Vercel Cron (see vercel.json). Protected by CRON_SECRET so nobody
// else can spin up billable agent runs.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runOrchestration();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
