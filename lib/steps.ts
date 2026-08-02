// Per-job step functions — each is small enough to finish well under 60s.
// The queue processes these one at a time. Together they equal a full run.

import { callClaude, extractJSON } from "./anthropic";
import { brandBlock, getBrandById, isLocalBusiness, type Brand } from "./brands";
import { db, TaskType } from "./supabase";
import { strikingDistance, lowCtrPages, pagesByIntentSignal, fullKeywordSync } from "./gsc";
import { writeContent, rewriteMeta, auditPage } from "./agents";
import { draftGbpPost, findCitations, fixIntent } from "./local-agents";
import { writeAnswerContent } from "./geo-agent";
import { keywordStrategy, competitorGaps } from "./intelligence";
import { keywordDifficulty, classifySearchIntent, keywordVolumes, geoOf } from "./dataforseo";
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

// ── Content-idea de-duplication & existing-page detection ──────────────────
// Prevents stepPlan() from suggesting a brand-new page/blog for a topic
// that's already published or already queued, and catches keyword
// cannibalization (two pages competing for the same topic).

type ExistingTopic = { keyword: string | null; url: string | null; title: string };

function normalizeTopic(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(blog|page|new blog|new page|intent fix|meta rewrite|audit \+ rewrite):\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function existingTopics(brandId: string): Promise<ExistingTopic[]> {
  const [{ data: content }, { data: drafts }] = await Promise.all([
    db.from("content").select("slug, title").eq("brand_id", brandId),
    db.from("drafts")
      .select("target_keyword, target_url, title")
      .eq("brand_id", brandId)
      .neq("status", "dismissed")
      .in("task_type", ["new_page", "new_blog", "improve_content"]),
  ]);
  return [
    ...(content || []).map((c) => ({ keyword: null as string | null, url: c.slug as string, title: c.title as string })),
    ...(drafts || []).map((d) => ({ keyword: d.target_keyword, url: d.target_url, title: d.title })),
  ];
}

// First existing topic that substantially overlaps a candidate keyword/title,
// or null if it looks genuinely new.
function findExistingMatch(candidate: string | undefined | null, existing: ExistingTopic[]): ExistingTopic | null {
  const norm = candidate ? normalizeTopic(candidate) : "";
  if (!norm) return null;
  for (const e of existing) {
    const eKeyword = e.keyword ? normalizeTopic(e.keyword) : "";
    const eTitle = normalizeTopic(e.title || "");
    if (eKeyword && (eKeyword === norm || eKeyword.includes(norm) || norm.includes(eKeyword))) return e;
    if (eTitle && (eTitle === norm || eTitle.includes(norm) || norm.includes(eTitle))) return e;
  }
  return null;
}

// PLAN: gather intelligence, decide tasks, and enqueue the execution jobs.
export async function stepPlan(brand: Brand) {
  const gsc = brand.gsc_property;
  const [striking, lowCtr, intentPages, strategy, recon, lessons, existing] = await Promise.all([
    gsc ? safe(() => strikingDistance(gsc)) : Promise.resolve(null),
    gsc ? safe(() => lowCtrPages(gsc)) : Promise.resolve(null),
    gsc && brand.intent_notes ? safe(() => pagesByIntentSignal(gsc, "free")) : Promise.resolve(null),
    safe(() => keywordStrategy(brand)),
    safe(() => competitorGaps(brand)),
    safe(() => activeLessons(brand)),
    safe(() => existingTopics(brand.id)),
  ]);
  const existingList = (existing as ExistingTopic[] | null) || [];

  const planText = await callClaude({
    maxTokens: 1800,
    user: `${brandBlock(brand)}

You are the SEO operations lead. Use ALL intelligence below to choose the ${MAX_TASKS} highest-impact actions now. Favour quick wins but also build topical authority.

RULES: Target paid/high-intent + long-tail keywords with real volume where known. Avoid any terms flagged as wrong-intent in the business context above.
NEVER propose "new_page" or "new_blog" for a topic already listed in EXISTING TOPICS below — if that topic needs work, propose "improve_content" targeting its existing URL instead. Also do not propose two of your own tasks in this batch for the same or overlapping topic (keyword cannibalization) — group related keywords under one page rather than forking a near-duplicate.

EXISTING TOPICS (already published or queued — do not duplicate):
${existingList.length ? existingList.map((e) => `- "${e.title}"${e.keyword ? ` (keyword: ${e.keyword})` : ""}${e.url ? ` → ${e.url}` : ""}`).join("\n") : "none yet"}

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
  let tasks = (extractJSON<{ task_type: TaskType; target_url?: string; target_keyword?: string; rationale: string }[]>(planText) || []).slice(0, MAX_TASKS);

  // Hard safety net — enforced regardless of whether the model followed the
  // prompt: never let a new_page/new_blog through for a topic that already
  // exists (redirect to improve_content on the existing URL instead), and
  // never let two tasks in the same batch target overlapping keywords.
  const claimedThisBatch: string[] = [];
  tasks = tasks.map((t) => {
    if (t.task_type !== "new_page" && t.task_type !== "new_blog") return t;
    const match = findExistingMatch(t.target_keyword, existingList);
    if (match) {
      return {
        ...t,
        task_type: "improve_content" as TaskType,
        target_url: match.url || t.target_url,
        rationale: `${t.rationale} (redirected from new page — topic already exists)`,
      };
    }
    const norm = normalizeTopic(t.target_keyword || "");
    if (norm && claimedThisBatch.includes(norm)) {
      return { ...t, task_type: "improve_content" as TaskType, rationale: `${t.rationale} (merged — overlapping keyword in this batch)` };
    }
    if (norm) claimedThisBatch.push(norm);
    return t;
  });

  const runId = await currentRun(brand.id);
  await db.from("runs").update({ tasks_planned: tasks.length }).eq("id", runId);

  // Enqueue one content job per task, plus intent fixes, then the extras.
  for (const t of tasks) await enqueue(brand.id, "content", { ...t, runId });
  for (const p of (intentPages as { page: string; queries: string[] }[] | null)?.slice(0, 2) || [])
    await enqueue(brand.id, "content", { task_type: "fix_meta", target_url: p.page, intent: true, queries: p.queries, runId });
  await enqueue(brand.id, "geo", { runId });
  // GBP posts + citation opportunities are local-SEO concepts (Google
  // Business Profile map-pack signals, local directory outreach) — meaningless
  // for a non-local brand, so skip them entirely rather than producing drafts
  // nobody will use (Sprint 6.2 Phase 3).
  if (isLocalBusiness(brand)) {
    await enqueue(brand.id, "gbp", { runId });
    await enqueue(brand.id, "citations", { runId });
  }
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
    await db.from("content").upsert(
      { slug, brand_id: brand.id, title: cleanTitle, body: cleanBody, published_at: new Date().toISOString() },
      { onConflict: "brand_id,slug" }
    );
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
  const audited = (result as { audited?: number } | null)?.audited || 0;
  const issues = (result as { issues?: { url: string; problem: string; severity: string; fix: string; task_type: string }[] } | null)?.issues || [];

  // Site Health score — derived from this same audit pass, no extra crawl or
  // AI call. Cached in `reports` (section="site_health") so metrics.snapshot()
  // can read it back with one fast query instead of re-running the crawl
  // inline (that used to happen and is why it was stripped to keep snapshot()
  // under the 60s function budget).
  if (audited > 0) {
    await db.from("reports").insert({
      brand_id: brand.id,
      section: "site_health",
      summary: JSON.stringify({ score: siteHealthScore(issues), audited, issue_count: issues.length }),
      cache_expires_at: new Date(Date.now() + 26 * 3600_000).toISOString(),
    });
  }

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

// 100 minus weighted deductions per issue severity found during the day's
// site audit, floored at 0 — a simple, defensible technical-SEO score
// derived entirely from auditSite()'s existing output.
function siteHealthScore(issues: { severity: string }[]): number {
  let score = 100;
  for (const i of issues) {
    if (i.severity === "high") score -= 15;
    else if (i.severity === "medium") score -= 7;
    else score -= 3;
  }
  return Math.max(0, Math.min(100, score));
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
    case "rank_sync": return void (await stepRankSync(b));
    case "rank_enrich": return void (await stepRankEnrich(b));
  }
}



// ── Sprint 4: Rank Sync & Enrich steps ──────────────────────────────────────


// Standard CTR curve by position (used for traffic opportunity estimates).
// Source: industry consensus averages for organic Google results.
function estimatedCtr(position: number): number {
  if (position <= 1) return 0.28;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.11;
  if (position <= 4) return 0.08;
  if (position <= 5) return 0.07;
  if (position <= 6) return 0.06;
  if (position <= 7) return 0.05;
  if (position <= 8) return 0.04;
  if (position <= 9) return 0.03;
  if (position <= 10) return 0.025;
  if (position <= 15) return 0.015;
  if (position <= 20) return 0.008;
  return 0.003;
}

// RANK SYNC: fetch all GSC keyword data, upsert tracked_keywords +
// keyword_positions, compute distribution snapshot, detect status changes.
export async function stepRankSync(brand: Brand) {
  if (!brand.gsc_property) return { skipped: "no gsc_property" };

  const today = new Date().toISOString().slice(0, 10);
  const rows = await fullKeywordSync(brand.gsc_property).catch((e) => {
    // TEMP DIAGNOSTIC (rank-sync silent-swallow investigation) -- remove once root cause confirmed.
    console.error("[rank_sync diagnostic] fullKeywordSync threw", {
      gsc_client_email_set: !!process.env.GSC_CLIENT_EMAIL,
      gsc_private_key_set: !!process.env.GSC_PRIVATE_KEY,
      gsc_property: brand.gsc_property,
      error_stack: e instanceof Error ? e.stack : String(e),
    });
    return [];
  });
  if (!rows.length) return { skipped: "no GSC data" };

  // TEMP DIAGNOSTIC (rank-sync silent-swallow investigation) -- remove once root cause confirmed.
  const t0 = Date.now();
  console.log("[rank_sync timing] before tracked_keywords upsert loop", {
    brand_id: brand.id, elapsed_ms: 0, keyword_count: rows.length,
  });

  // --- Upsert tracked_keywords ---
  // Build a map of keyword → row for fast lookup
  const byKeyword = new Map(rows.map((r) => [r.keyword, r]));
  const keywords = [...byKeyword.keys()];

  // Fetch existing tracked_keywords for this brand to compute status changes
  const { data: existing } = await db
    .from("tracked_keywords")
    .select("id, keyword, best_position, worst_position, status")
    .eq("brand_id", brand.id);
  const existingMap = new Map(
    (existing || []).map((e) => [e.keyword, e])
  );

  // Upsert each keyword, batched (≤200 rows per request) instead of one
  // request per keyword -- avoids up to 516 sequential unprotected round
  // trips within a single job execution.
  const trackedKeywordRows = keywords.map((kw) => {
    const row = byKeyword.get(kw)!;
    const prev = existingMap.get(kw);
    const pos = row.position;

    // Compute lifetime best/worst
    const newBest = prev?.best_position == null || pos < prev.best_position ? pos : prev.best_position;
    const newWorst = prev?.worst_position == null || pos > prev.worst_position ? pos : prev.worst_position;

    return {
      brand_id: brand.id,
      keyword: kw,
      best_position: newBest,
      best_position_date: newBest === pos ? today : undefined,
      worst_position: newWorst,
      first_seen_date: prev ? undefined : today,
      last_seen_date: null, // currently ranking
      status: prev ? computeStatus(prev.best_position, pos) : "new",
    };
  });

  for (let i = 0; i < trackedKeywordRows.length; i += 200) {
    const { error: tkError } = await db.from("tracked_keywords").upsert(
      trackedKeywordRows.slice(i, i + 200),
      { onConflict: "brand_id,keyword", ignoreDuplicates: false }
    );
    if (tkError) {
      throw new Error(`stepRankSync: tracked_keywords batch upsert failed at offset ${i}: ${tkError.message}`);
    }
  }

  // TEMP DIAGNOSTIC (rank-sync silent-swallow investigation) -- remove once root cause confirmed.
  console.log("[rank_sync timing] after tracked_keywords upsert loop", {
    brand_id: brand.id, elapsed_ms: Date.now() - t0, keywords_upserted: keywords.length,
  });

  // Mark keywords that were tracked but not in today's GSC as "lost"
  const lostKeywords = (existing || []).filter(
    (e) => !byKeyword.has(e.keyword) && e.status !== "lost"
  );
  for (const lost of lostKeywords) {
    await db.from("tracked_keywords").update({
      status: "lost",
      last_seen_date: today,
    }).eq("id", lost.id);
  }

  // --- Fetch keyword IDs for the position insert ---
  // Batched (≤200 per request) like the upsert loop above -- unlike the
  // upsert (a POST with a JSON body), .in() on a .select() is a GET with
  // the value list embedded in the URL, which hits PostgREST's gateway URL
  // length limit well before 516+ keywords fit in one request.
  const kwIds: { id: string; keyword: string }[] = [];
  for (let i = 0; i < keywords.length; i += 200) {
    const { data: kwIdsBatch, error: kwIdsError } = await db
      .from("tracked_keywords")
      .select("id, keyword")
      .eq("brand_id", brand.id)
      .in("keyword", keywords.slice(i, i + 200));
    if (kwIdsError) {
      throw new Error(`stepRankSync: tracked_keywords id lookup failed at offset ${i}: ${kwIdsError.message}`);
    }
    kwIds.push(...(kwIdsBatch || []));
  }
  const kwIdMap = new Map(kwIds.map((k) => [k.keyword, k.id]));

  // --- Upsert keyword_positions ---
  const positionRows = rows
    .filter((r) => kwIdMap.has(r.keyword))
    .map((r) => ({
      brand_id: brand.id,
      keyword_id: kwIdMap.get(r.keyword)!,
      keyword: r.keyword,
      position: r.position,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      landing_page: r.page,
      captured_date: today,
    }));

  // TEMP DIAGNOSTIC (rank-sync silent-swallow investigation) -- remove once root cause confirmed.
  console.log("[rank_sync timing] before keyword_positions upsert", {
    brand_id: brand.id, elapsed_ms: Date.now() - t0,
    kwIds_returned: kwIds.length, keywords_requested: keywords.length,
    position_rows_to_write: positionRows.length,
  });

  // Insert in batches of 200 to stay under payload limits
  for (let i = 0; i < positionRows.length; i += 200) {
    const { error: kpError } = await db.from("keyword_positions").upsert(
      positionRows.slice(i, i + 200),
      { onConflict: "brand_id,keyword,captured_date", ignoreDuplicates: false }
    );
    if (kpError) {
      throw new Error(`stepRankSync: keyword_positions batch upsert failed at offset ${i}: ${kpError.message}`);
    }
  }

  // TEMP DIAGNOSTIC (rank-sync silent-swallow investigation) -- remove once root cause confirmed.
  console.log("[rank_sync timing] after keyword_positions upsert", {
    brand_id: brand.id, elapsed_ms: Date.now() - t0,
    batches_written: Math.ceil(positionRows.length / 200),
  });

  // --- Compute position distribution snapshot ---
  const dist = {
    brand_id: brand.id,
    captured_date: today,
    top_3: 0, top_10: 0, top_20: 0, top_50: 0, top_100: 0, not_ranked: 0,
    new_this_week: 0, lost_this_week: 0, improved_this_week: 0, declined_this_week: 0,
    total_clicks: 0, total_impressions: 0, avg_ctr: 0,
  };
  let ctrSum = 0;
  for (const r of rows) {
    const p = r.position;
    if (p <= 3) dist.top_3++;
    if (p <= 10) dist.top_10++;
    if (p <= 20) dist.top_20++;
    if (p <= 50) dist.top_50++;
    if (p <= 100) dist.top_100++;
    dist.total_clicks += r.clicks;
    dist.total_impressions += r.impressions;
    ctrSum += r.ctr;
  }
  dist.not_ranked = lostKeywords.length;
  dist.new_this_week = (existing || []).filter((e) => e.status === "new").length;
  dist.lost_this_week = lostKeywords.length;
  dist.avg_ctr = rows.length ? ctrSum / rows.length : 0;

  // TEMP DIAGNOSTIC (rank-sync silent-swallow investigation) -- remove once root cause confirmed.
  console.log("[rank_sync timing] before position_distribution_snapshots upsert", {
    brand_id: brand.id, elapsed_ms: Date.now() - t0, captured_date: today,
  });

  const { error: distError } = await db.from("position_distribution_snapshots").upsert(dist, {
    onConflict: "brand_id,captured_date",
  });
  if (distError) {
    throw new Error(`stepRankSync: position_distribution_snapshots upsert failed: ${distError.message}`);
  }

  // TEMP DIAGNOSTIC (rank-sync silent-swallow investigation) -- remove once root cause confirmed.
  console.log("[rank_sync timing] after position_distribution_snapshots upsert", {
    brand_id: brand.id, elapsed_ms: Date.now() - t0, error: distError,
  });

  return {
    synced: rows.length,
    lost: lostKeywords.length,
    distribution: { top_10: dist.top_10, top_20: dist.top_20 },
  };
}

function computeStatus(bestPosition: number | null, currentPosition: number): string {
  if (!bestPosition) return "new";
  const diff = currentPosition - bestPosition;
  if (diff <= -3) return "improving";
  if (diff >= 3) return "declining";
  return "stable";
}

// RANK ENRICH: weekly DataForSEO enrichment + AI opportunity scoring.
// Processes up to 50 keywords per run (batched to control cost).
// Only processes keywords where enriched_at is null or > 7 days old.
export async function stepRankEnrich(brand: Brand) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const { data: toEnrich } = await db
    .from("tracked_keywords")
    .select("id, keyword, search_volume, best_position, status")
    .eq("brand_id", brand.id)
    .or(`enriched_at.is.null,enriched_at.lt.${sevenDaysAgo}`)
    .neq("status", "lost")
    .limit(50);

  if (!toEnrich?.length) return { enriched: 0 };

  const keywords = toEnrich.map((k) => k.keyword);

  // --- DataForSEO: volume + CPC (confirmed endpoint) ---
  const geo = geoOf(brand);
  const volumeData = await keywordVolumes(keywords, geo).catch(() => []);
  const volumeMap = new Map(volumeData.map((v) => [v.keyword, v]));

  // --- DataForSEO: difficulty (unverified endpoint, fails gracefully) ---
  const difficultyData = await keywordDifficulty(keywords, geo).catch(() => []);
  const difficultyMap = new Map(difficultyData.map((d) => [d.keyword, d.difficulty]));

  // --- DataForSEO: intent (unverified endpoint, fails gracefully) ---
  const intentData = await classifySearchIntent(keywords, geo).catch(() => []);
  const intentMap = new Map(intentData.map((i) => [i.keyword, i.intent]));

  // --- AI opportunity scoring (Claude) ---
  // Process in a single batch prompt for efficiency
  const kwContext = toEnrich.map((k) => ({
    keyword: k.keyword,
    position: k.best_position,
    volume: volumeMap.get(k.keyword)?.volume ?? null,
    difficulty: difficultyMap.get(k.keyword) ?? null,
    intent: intentMap.get(k.keyword) ?? null,
    status: k.status,
  }));

  const aiText = await callClaude({
    maxTokens: 2000,
    user: `You are an SEO strategist for a local service business.

BUSINESS: ${brand.name} — ${brand.services} in ${brand.service_area}.

Score each keyword 0-100 for opportunity (100 = highest priority to work on now).
Factors: local relevance, commercial intent, achievable position improvement, search volume vs difficulty.
Penalize: already ranking top 3, zero volume, purely informational intent for service businesses.

Keywords to score:
${JSON.stringify(kwContext, null, 2)}

Return ONLY JSON array:
[{"keyword":"...","score":0-100,"reason":"one sentence why"}]`,
  }).catch(() => null);

  const aiScores = extractJSON<{ keyword: string; score: number; reason: string }[]>(aiText || "") || [];
  const aiMap = new Map(aiScores.map((s) => [s.keyword, s]));

  // --- Compute traffic + revenue opportunity ---
  const brandData = brand as Brand & {
    avg_job_value?: number;
    lead_conversion_rate?: number;
    visitor_lead_rate?: number;
  };
  const revenueConfigured =
    brandData.avg_job_value != null &&
    brandData.lead_conversion_rate != null &&
    brandData.visitor_lead_rate != null;

  // --- Upsert enriched data ---
  const now = new Date().toISOString();
  for (const kw of toEnrich) {
    const vol = volumeMap.get(kw.keyword);
    const volume = vol?.volume ?? kw.search_volume;
    const ai = aiMap.get(kw.keyword);

    // Traffic opportunity: estimated clicks if ranking #1
    const estimatedClicks = volume
      ? Math.round(volume * estimatedCtr(1))
      : null;

    // Revenue opportunity: only when brand has all three rate fields
    let revenueImpact: string | null = null;
    if (revenueConfigured && estimatedClicks) {
      const leads = estimatedClicks * brandData.visitor_lead_rate!;
      const customers = leads * brandData.lead_conversion_rate!;
      const revenue = customers * brandData.avg_job_value!;
      revenueImpact = `~$${Math.round(revenue).toLocaleString()}/month if ranking #1`;
    }

    await db.from("tracked_keywords").update({
      search_volume: volume ?? undefined,
      cpc: vol?.cpc ?? undefined,
      keyword_difficulty: difficultyMap.get(kw.keyword) ?? undefined,
      search_intent: intentMap.get(kw.keyword) ?? undefined,
      ai_opportunity_score: ai?.score ?? undefined,
      ai_opportunity_reason: ai?.reason ?? undefined,
      estimated_monthly_clicks: estimatedClicks ?? undefined,
      estimated_revenue_impact: revenueImpact,
      enriched_at: now,
    }).eq("id", kw.id);
  }

  return { enriched: toEnrich.length };
}
