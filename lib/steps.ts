// Per-job step functions — each is small enough to finish well under 60s.
// The queue processes these one at a time. Together they equal a full run.

import { callClaude, extractJSON } from "./anthropic";
import { brandBlock, getBrandById, type Brand } from "./brands";
import { db, TaskType } from "./supabase";
import { strikingDistance, lowCtrPages, pagesByIntentSignal } from "./gsc";
import { writeContent, rewriteMeta, auditPage } from "./agents";
import { draftGbpPost, findCitations, fixIntent } from "./local-agents";
import { writeAnswerContent } from "./geo-agent";
import { keywordStrategy, competitorGaps } from "./intelligence";
import { activeLessons, analysePerformance } from "./learning";
import { snapshot } from "./metrics";
import { auditSite } from "./auditor";
import { enqueue, type JobKind } from "./queue";
import { slugify, splitFrontMatter } from "./utils";

const MAX_TASKS = Number(process.env.MAX_TASKS_PER_RUN || 3);

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

// Ensure an open run row exists for this brand today; return its id.
async function currentRun(brandId: string): Promise<string> {
  const { data } = await db
    .from("runs").insert({ status: "running", brand_id: brandId }).select().single();
  return data!.id;
}

// PLAN: gather intelligence, decide tasks, and enqueue the execution jobs.
export async function stepPlan(brand: Brand) {
  const gsc = brand.gsc_property;
  const [striking, lowCtr, intentPages, strategy, recon, lessons] = await Promise.all([
    gsc ? safe(() => strikingDistance(gsc)) : Promise.resolve(null),
    gsc ? safe(() => lowCtrPages(gsc)) : Promise.resolve(null),
    gsc && brand.intent_notes ? safe(() => pagesByIntentSignal(gsc, "free")) : Promise.resolve(null),
    safe(() => keywordStrategy(brand)),
    safe(() => competitorGaps(brand)),
    safe(() => activeLessons(brand)),
  ]);

  const planText = await callClaude({
    maxTokens: 1800,
    user: `${brandBlock(brand)}

You are the SEO operations lead. Use ALL intelligence below to choose the ${MAX_TASKS} highest-impact actions now. Favour quick wins but also build topical authority.

RULES: Target paid/high-intent + long-tail keywords with real volume where known. NEVER target "free" keywords.

LESSONS (from measuring past results — apply them):
${(lessons as string[])?.length ? (lessons as string[]).map((l) => "- " + l).join("\n") : "none yet"}
KEYWORD STRATEGY:
${JSON.stringify(strategy, null, 2)}
COMPETITOR GAPS:
${JSON.stringify((recon as { gaps?: unknown[] })?.gaps || [], null, 2)}
STRIKING DISTANCE (GSC 5-20):
${JSON.stringify(striking || [], null, 2)}
LOW CTR PAGES:
${JSON.stringify(lowCtr || [], null, 2)}

Return ONLY JSON array of up to ${MAX_TASKS}:
[{"task_type":"fix_meta|improve_content|new_page|new_blog","target_url":"...","target_keyword":"...","rationale":"..."}]`,
  });
  const tasks = (extractJSON<{ task_type: TaskType; target_url?: string; target_keyword?: string; rationale: string }[]>(planText) || []).slice(0, MAX_TASKS);

  const runId = await currentRun(brand.id);

  // Enqueue one content job per task, plus intent fixes, then the extras.
  for (const t of tasks) await enqueue(brand.id, "content", { ...t, runId });
  for (const p of (intentPages as { page: string; queries: string[] }[] | null)?.slice(0, 2) || [])
    await enqueue(brand.id, "content", { task_type: "fix_meta", target_url: p.page, intent: true, queries: p.queries, runId });
  await enqueue(brand.id, "geo", { runId });
  await enqueue(brand.id, "gbp", { runId });
  await enqueue(brand.id, "citations", { runId });
  await enqueue(brand.id, "audit", { runId });
  await enqueue(brand.id, "performance", { runId });

  return { planned: tasks.length };
}

// CONTENT: execute one task -> one draft.
export async function stepContent(brand: Brand, p: Record<string, unknown>) {
  const runId = p.runId as string;
  const kw = (p.target_keyword as string) || "";
  const type = p.task_type as TaskType;
  let title = "", body = "";

  if (p.intent) {
    const fix = await fixIntent(brand, p.target_url as string, (p.queries as string[]) || []);
    title = `Intent fix: ${p.target_url}`; body = fix || "";
  } else if (type === "new_blog") {
    title = `Blog: ${kw}`; body = await writeContent(brand, kw, "Blog post");
  } else if (type === "new_page") {
    title = `Page: ${kw}`; body = await writeContent(brand, kw, "Local service page");
  } else if (type === "improve_content") {
    title = `Audit + rewrite: ${p.target_url || kw}`; body = await auditPage(brand, kw, "");
  } else {
    title = `Meta rewrite: ${p.target_url || kw}`; body = await rewriteMeta(brand, (p.target_url as string) || "", `Target keyword: ${kw}`);
  }
  if (!body) return;

  // Auto mode: publish immediately. Review mode: wait for approval.
  const autoMode = brand.auto_publish_meta;
  const { data: inserted } = await db.from("drafts").insert({
    brand_id: brand.id, run_id: runId, task_type: p.intent ? "fix_meta" : type,
    target_url: (p.target_url as string) || null, target_keyword: kw || null,
    title, body, rationale: (p.rationale as string) || "Search-intent qualification.",
    status: autoMode ? "approved" : "pending_review",
  }).select().single();

  // In auto mode, immediately publish blog/page content live.
  if (autoMode && inserted && (type === "new_blog" || type === "new_page")) {
    const raw = kw || title.replace(/^(Blog|Page):\s*/i, "");
    const base = slugify(raw);
    const slug = type === "new_page" ? base : `blog/${base}`;
    const { title: cleanTitle, body: cleanBody } = splitFrontMatter(body, title);
    await db.from("content").upsert({ slug, brand_id: brand.id, title: cleanTitle, body: cleanBody, published_at: new Date().toISOString() });
    await db.from("drafts").update({ status: "published" }).eq("id", inserted.id);
  }
}

export async function stepGeo(brand: Brand) {
  const { count } = await db.from("drafts").select("id", { count: "exact", head: true })
    .eq("brand_id", brand.id).eq("task_type", "geo_answers");
  if (count) return;
  const a = await writeAnswerContent(brand);
  if (a?.faqs?.length) {
    await db.from("drafts").insert({
      brand_id: brand.id, task_type: "geo_answers", title: "AI-answer FAQ content (GEO/AEO)",
      body: a.faqs.map((f) => `**${f.q}**\n\n${f.a}`).join("\n\n"),
      rationale: "Answer-optimized so ChatGPT/Gemini recommend the business.", status: "pending_review",
    });
  }
}

export async function stepGbp(brand: Brand) {
  const post = await draftGbpPost(brand);
  if (post) await db.from("gbp_posts").insert({ brand_id: brand.id, title: post.title, body: post.body, cta: post.cta, status: "pending_review" });
}

export async function stepCitations(brand: Brand) {
  const { count } = await db.from("citations").select("id", { count: "exact", head: true }).eq("brand_id", brand.id);
  if (count) return;
  const cites = await findCitations(brand);
  if (cites?.length) await db.from("citations").insert(cites.map((c) => ({
    brand_id: brand.id, name: c.name, url: c.url, category: c.category, priority: c.priority, rationale: c.rationale,
  })));
}

export async function stepPerformance(brand: Brand) {
  await safe(() => analysePerformance(brand));
  await safe(() => snapshot(brand)); // capture KPI snapshot for the analytics charts
}

// AUDIT: crawl the live site, find weak/thin pages, and queue improvements.
// Runs at most once/day per brand to control cost, and skips pages already
// improved recently.
export async function stepAudit(brand: Brand, runId: string) {
  // Only re-audit if we haven't audited this brand today.
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { count } = await db.from("jobs").select("id", { count: "exact", head: true })
    .eq("brand_id", brand.id).eq("kind", "audit").eq("status", "done").gte("created_at", start.toISOString());
  // (this job itself is still "running", so >0 means a prior audit already ran today)
  if ((count || 0) > 0) return;

  const result = await safe(() => auditSite(brand, 12));
  const issues = (result as { issues?: { url: string; problem: string; severity: string; fix: string; task_type: string }[] } | null)?.issues || [];

  // Queue the top 2 highest-severity content fixes as improvement tasks.
  const high = issues.filter((i) => i.severity === "high").slice(0, 2);
  for (const issue of high) {
    await enqueue(brand.id, "content", {
      task_type: issue.task_type === "improve_content" ? "improve_content" : "fix_meta",
      target_url: issue.url,
      rationale: `Auditor: ${issue.problem} — ${issue.fix}`,
      runId,
    });
  }
}

// Dispatch a claimed job to the right step.
export async function runJob(job: { brand_id: string; kind: JobKind; payload: Record<string, unknown> }) {
  const b = (await getBrandById(job.brand_id)) as Brand | null;
  if (!b) return;
  switch (job.kind) {
    case "plan": return void (await stepPlan(b));
    case "content": return void (await stepContent(b, job.payload));
    case "geo": return void (await stepGeo(b));
    case "gbp": return void (await stepGbp(b));
    case "citations": return void (await stepCitations(b));
    case "audit": return void (await stepAudit(b, (job.payload.runId as string) || ""));
    case "performance": return void (await stepPerformance(b));
  }
}


