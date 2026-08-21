// Per-job step functions — each is small enough to finish well under 60s.
// The queue processes these one at a time. Together they equal a full run.

import { callClaude, extractJSON } from "./anthropic";
import { getBrandById, type Brand } from "./brands";
import { db, TaskType } from "./supabase";
import { pagesByIntentSignal, fullKeywordSync } from "./gsc";
import { writeContent, rewriteMeta, auditPage, reviseDraft } from "./agents";
import { draftGbpPost, findCitations, fixIntent } from "./local-agents";
import { writeAnswerContent } from "./geo-agent";
import { keywordDifficulty, classifySearchIntent, keywordVolumes, geoOf, isConfigured } from "./dataforseo";
import { analysePerformance } from "./learning";
import { snapshot } from "./metrics";
import { auditSite, inspectPage, RENDER_THRESHOLD_WORDS, type AuditedPage } from "./auditor";
import { canUse } from "./capabilities";
import { enqueue, type JobKind } from "./queue";
import { slugify, splitFrontMatter } from "./utils";
import { contentPublishFields } from "./content-publish";
import { executeChange, resolvePublishTarget } from "./execution/engine";
import { toSiteChange, type DraftLike } from "./execution/changes";
import { isDraftAutopilot, isSectionAutopilot } from "./recommendations/sections";
import { overlapsTopic, topicKey, topicSlug } from "./recommendations/topic";
import { stepAiVisibility } from "./ai-visibility/run";
import { runSeoManager } from "./seo-manager";
import { runQaCritic, canAutoPublishAfterQa } from "./qa";
import { decidePolicy, resolveExecutionMode } from "./policy";
import { buildSharedContext } from "./agents/context";
import { recordActivity, updateAgentTask, linkQaResultToDraft, countPendingContentJobs } from "./agents/store";
import { MAX_MANAGER_ITEMS, clampConfidence, normalizeRisk, type ProposedActionType, type RiskLevel } from "./agents/contracts";
import { absolutePageUrl, checkPublishedPage, expectedSnippet } from "./publish-check";
import { reportOutcomes } from "./outcomes";
import { capabilityForTaskType } from "./execution/site-capabilities";
import { isOperationAutopilotReady } from "./execution/source-of-truth";
import { stepCertify } from "./execution/certify";

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

type ExistingTopic = { keyword: string | null; url: string | null; title: string; task_type?: string | null };

async function existingTopics(brandId: string): Promise<ExistingTopic[]> {
  const [{ data: content }, { data: drafts }] = await Promise.all([
    db.from("content").select("slug, title").eq("brand_id", brandId),
    db.from("drafts")
      .select("target_keyword, target_url, title, task_type")
      .eq("brand_id", brandId)
      .neq("status", "dismissed")
      .in("task_type", ["new_page", "new_blog", "improve_content"]),
  ]);
  return [
    ...(content || []).map((c) => ({ keyword: null as string | null, url: c.slug as string, title: c.title as string })),
    ...(drafts || []).map((d) => ({
      keyword: d.target_keyword,
      url: d.target_url,
      title: d.title,
      task_type: d.task_type,
    })),
  ];
}

// First existing topic that substantially overlaps a candidate keyword/title,
// or null if it looks genuinely new.
function findExistingMatch(candidate: string | undefined | null, existing: ExistingTopic[]): ExistingTopic | null {
  if (!candidate) return null;
  return existing.find((e) => overlapsTopic(candidate, {
    keyword: e.keyword,
    title: e.title,
    url: e.url,
    task_type: e.task_type,
  })) || null;
}

function alreadyQueued(
  task: { task_type?: string; target_keyword?: string; target_url?: string; title?: string },
  existing: ExistingTopic[]
): boolean {
  if (!topicSlug(task) && !task.target_keyword) return false;
  const key = topicKey({
    taskType: task.task_type,
    keyword: task.target_keyword,
    url: task.target_url,
    title: task.title,
  });
  return existing.some((e) => {
    const eKey = topicKey({
      taskType: e.task_type || task.task_type,
      keyword: e.keyword,
      url: e.url,
      title: e.title,
    });
    if (topicSlug(task) && eKey === key) return true;
    return overlapsTopic(task.target_keyword || topicSlug(task), e);
  });
}

function readPlanKeyword(t: { target_keyword?: string; keyword?: string; target_url?: string }): string {
  return (t.target_keyword || t.keyword || "").trim();
}

function factRationale(
  task: { target_keyword?: string; rationale: string },
  strategy: { targets?: { keyword: string; volume: number | null; why?: string; intent?: string }[] } | null,
  recon: { gaps?: { keyword: string; volume: number; why?: string; competitor?: string; competitor_position?: number }[] } | null,
  striking: { keyword: string; impressions: number; position: number }[] | null
): string {
  const kw = task.target_keyword || "";
  const slug = topicSlug({ keyword: kw });
  const facts: string[] = [];
  const target = strategy?.targets?.find((t) => topicSlug({ keyword: t.keyword }) === slug);
  if (target?.volume != null && target.volume > 0) {
    facts.push(`Google records about ${target.volume.toLocaleString()} searches a month for this.`);
  }
  if (target?.intent) {
    facts.push(`This is a ${target.intent} search.`);
  }
  const gap = recon?.gaps?.find((g) => topicSlug({ keyword: g.keyword }) === slug);
  if (gap?.competitor) {
    const host = gap.competitor.replace(/^www\./, "");
    if (gap.competitor_position != null && gap.competitor_position > 0) {
      facts.push(`${host} currently ranks around position ${gap.competitor_position} for this search.`);
    } else {
      facts.push(`${host} already ranks for this search.`);
    }
  } else if (gap?.volume && !(target?.volume != null && target.volume > 0)) {
    facts.push(`A tracked competitor already ranks for this search, which has about ${gap.volume.toLocaleString()} monthly searches.`);
  }
  if (gap?.why) facts.push(gap.why);
  const gsc = striking?.find((s) => topicSlug({ keyword: s.keyword }) === slug);
  if (gsc) {
    facts.push(`Search Console shows about ${gsc.impressions.toLocaleString()} impressions, currently around position ${gsc.position}.`);
  }
  const rationale = (task.rationale || "").trim();
  if (!facts.length) return rationale;
  const extra = facts.join(" ");
  if (!rationale) return extra;
  if (target?.volume && rationale.includes(String(target.volume))) return rationale;
  if (gap?.volume && rationale.includes(String(gap.volume))) return rationale;
  return `${rationale}\n\n${extra}`;
}

// PLAN: the SEO Manager coordinates research + content jobs.
// Backlog gate and intent fixes stay here so the queue cannot flood.
export async function stepPlan(brand: Brand) {
  // If the review queue is already full, do not pile on more content drafts.
  // Operators were seeing the same July suggestions forever because new runs
  // kept adding near-duplicates while old pending_review rows were never
  // dismissed. Meta/intent fixes below still run when backlog is high.
  const { count: openDraftCount } = await db
    .from("drafts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brand.id)
    .eq("status", "pending_review");
  const backlogFull = (openDraftCount || 0) >= Math.max(MAX_TASKS * 2, 6);

  const runId = await currentRun(brand.id);
  const gsc = brand.gsc_property;
  const intentPages =
    gsc && brand.intent_notes
      ? await safe(() => pagesByIntentSignal(gsc, "free"))
      : null;

  let planned = 0;
  if (!backlogFull) {
    const result = await runSeoManager(brand, runId);
    planned = result.planned;
  } else {
    console.log(
      `[stepPlan] ${brand.slug}: skipping new content plan — ${openDraftCount} pending_review drafts (backlog gate)`
    );
    // Outcome reporter still needs a performance pass.
    await enqueue(brand.id, "performance", { runId });
    await db.from("runs").update({ tasks_planned: 0 }).eq("id", runId);
  }

  for (const p of (intentPages as { page: string; queries: string[] }[] | null)?.slice(0, 2) || []) {
    await enqueue(brand.id, "content", {
      task_type: "fix_meta",
      target_url: p.page,
      intent: true,
      queries: p.queries,
      runId,
      risk_level: "low",
      confidence: 0.7,
    });
  }

  return { planned, backlog_gated: backlogFull };
}

// CONTENT: execute one task -> one draft, then QA + policy for status/publish.
export async function stepContent(brand: Brand, p: Record<string, unknown>) {
  const runId = p.runId as string;
  const agentTaskId = (p.agentTaskId as string) || null;
  const kw = String(p.target_keyword || p.keyword || "").trim();
  const type = p.task_type as TaskType;

  if (agentTaskId) {
    await updateAgentTask(brand.id, agentTaskId, {
      status: "running",
      started_at: new Date().toISOString(),
    });
  }

  // Final guard: if an open draft already covers this topic, do not insert
  // another review card. Check by slug (keyword OR planned URL), not just the
  // raw keyword string — that is what produced "junk removal cost" twice.
  if (!p.intent) {
    const existing = await existingTopics(brand.id);
    if (alreadyQueued({
      task_type: type,
      target_keyword: kw,
      target_url: (p.target_url as string) || undefined,
      title: kw,
    }, existing)) {
      console.log(`[stepContent] ${brand.slug}: skip duplicate draft for "${kw || p.target_url}"`);
      return;
    }
  }

  let title = "", body = "";

  if (p.intent) {
    const fix = await fixIntent(brand, p.target_url as string, (p.queries as string[]) || []);
    title = `Intent fix: ${p.target_url}`; body = fix || "";
  } else if (type === "new_blog") {
    title = `Blog: ${kw}`; body = await writeContent(brand, kw, "Blog post");
  } else if (type === "new_page") {
    title = `Page: ${kw}`; body = await writeContent(brand, kw, "Local service page");
  } else if (type === "improve_content") {
    // Phase 8A: this passed "" for the page's content, so auditPage() never saw
    // the page it was auditing and returned a generic checklist of what a page
    // targeting this keyword *should* contain. Fetching the live page first is
    // the difference between a template and an actual audit. inspectPage is the
    // crawler stepAudit already uses, so nothing new fetches or parses HTML.
    const auditUrl = (p.target_url as string) || "";
    // Phase 8B: opt into JS rendering. inspectPage only pays for a render when
    // the raw HTML comes back too short to be the real page, so a
    // server-rendered target costs nothing extra. Gated so a future plan tier
    // can turn it off without touching this logic.
    const render = canUse(brand, "js_rendering");
    const live = auditUrl ? await safe(() => inspectPage(auditUrl, { render })) : null;

    // Only pass the fetched text if enough of it came back to be the real page.
    // With rendering on this is now rarely the fallback path, but it still
    // guards the cases rendering can't fix — an unreachable host, a render
    // failure, or a page that genuinely is near-empty. Handing the agent a
    // shell is worse than handing it nothing: it would conclude the page is
    // almost empty and recommend rewriting content that is actually there.
    // auditPage's prompt already handles "no content provided" explicitly.
    const readable = live && live.words >= RENDER_THRESHOLD_WORDS ? live.text : "";
    if (live && !readable) {
      console.warn(
        `[stepContent] ${brand.slug}: ${auditUrl} yielded only ${live.words} words ` +
        `(render=${render}) — auditing without page content.`
      );
    }

    title = `Audit + rewrite: ${p.target_url || kw}`;
    body = await auditPage(brand, kw, readable);
  } else {
    title = `Meta rewrite: ${p.target_url || kw}`; body = await rewriteMeta(brand, (p.target_url as string) || "", `Target keyword: ${kw}`);
  }
  if (!body) {
    if (agentTaskId) {
      await updateAgentTask(brand.id, agentTaskId, {
        status: "failed",
        error: "Empty specialist output",
        finished_at: new Date().toISOString(),
      });
    }
    return;
  }

  // Re-check after the slow write. Two jobs can both pass the first guard,
  // spend 30s writing, then both insert the same page.
  if (!p.intent) {
    const existing = await existingTopics(brand.id);
    if (alreadyQueued({
      task_type: (p.intent ? "fix_meta" : type) as string,
      target_keyword: kw,
      target_url: (p.target_url as string) || undefined,
      title,
    }, existing)) {
      console.log(`[stepContent] ${brand.slug}: skip duplicate insert for "${kw || title}"`);
      return;
    }
  }

  let effectiveType = (p.intent ? "fix_meta" : type) as TaskType;
  let effectiveUrl = (p.target_url as string) || null;
  let rationale = (p.rationale as string) || "Search-intent qualification.";
  if (effectiveType === "new_page" || effectiveType === "new_blog") {
    const existing = await existingTopics(brand.id);
    const match = findExistingMatch(kw, existing);
    if (match) {
      effectiveType = "improve_content";
      effectiveUrl = match.url || effectiveUrl;
      rationale = `${rationale} (redirected from new page — topic already exists)`;
    }
  }

  const risk = normalizeRisk(p.risk_level, effectiveType === "fix_meta" ? "low" : "medium");
  const confidence = clampConfidence(p.confidence, effectiveType === "fix_meta" ? 0.75 : 0.6);

  const ctx = await buildSharedContext(brand, { runId, objective: title });
  let qa = await runQaCritic({
    brand,
    ctx,
    runId,
    taskId: agentTaskId,
    title,
    body,
    taskType: effectiveType,
    targetKeyword: kw || null,
    revisionAttempt: 0,
  });

  // Bounded single revision attempt on REVISE.
  if (qa.evaluation.outcome === "REVISE" && !p.intent) {
    const revised = await reviseDraft(brand, body, qa.evaluation.feedback).catch(() => "");
    if (revised) {
      body = revised;
      qa = await runQaCritic({
        brand,
        ctx,
        runId,
        taskId: agentTaskId,
        title,
        body,
        taskType: effectiveType,
        targetKeyword: kw || null,
        revisionAttempt: 1,
      });
      await recordActivity({
        brandId: brand.id,
        runId,
        taskId: agentTaskId,
        capability: "content",
        eventType: "content_revised",
        title: `Revised after QA: ${title.slice(0, 80)}`,
        status: "info",
      });
    }
  }

  const publishTarget = await resolvePublishTarget(brand.id);
  const sectionAuto = isDraftAutopilot(brand, effectiveType);
  const brandMode = resolveExecutionMode(brand);
  // Per-tab Autopilot remains the owner's desk switch. Off = approval.
  // On + default approval mode = treat as autopilot so QA can still gate.
  const mode = sectionAuto ? (brandMode === "approval" ? "autopilot" : brandMode) : "approval";
  const actionType = effectiveType as ProposedActionType;
  const pendingContent = await countPendingContentJobs(brand.id);
  const liveOp = capabilityForTaskType(effectiveType);
  const policy = decidePolicy({
    brandId: brand.id,
    mode,
    autopilotEnabled: brand.autopilot_enabled !== false && sectionAuto,
    actionType,
    riskLevel: risk as RiskLevel,
    confidence,
    qaOutcome: qa.evaluation.outcome,
    adapterAvailable: publishTarget.ok,
    reversible: effectiveType === "fix_meta",
    withinRunLimits: pendingContent <= MAX_MANAGER_ITEMS + 4,
    requiresLivePublish: liveOp !== null,
    operationCertified: liveOp ? isOperationAutopilotReady(brand, liveOp) : false,
    cannibalizationSuspected: rationale.includes("topic already exists"),
  });

  let status: "pending_review" | "approved" | "published" = "pending_review";
  if (qa.evaluation.outcome === "BLOCK" || policy.decision === "BLOCK") {
    status = "pending_review";
  } else if (policy.decision === "AUTO_EXECUTE" && canAutoPublishAfterQa(qa.evaluation.outcome)) {
    status = "approved";
  } else {
    status = "pending_review";
  }

  const { data: inserted } = await db.from("drafts").insert({
    brand_id: brand.id,
    run_id: runId,
    task_type: effectiveType,
    target_url: effectiveUrl,
    target_keyword: kw || null,
    title,
    body,
    rationale: `${rationale} | policy: ${policy.decision} (${policy.reason}) | QA: ${qa.evaluation.outcome}`,
    status,
  }).select().single();

  if (inserted?.id) {
    await linkQaResultToDraft(brand.id, inserted.id, {
      qaId: qa.qaId,
      taskId: agentTaskId,
    });
  }

  await recordActivity({
    brandId: brand.id,
    runId,
    taskId: agentTaskId,
    capability: "content",
    eventType: status === "approved" ? "auto_approved" : "draft_queued",
    title: status === "approved"
      ? `Auto-approved: ${title.slice(0, 80)}`
      : `Waiting for approval: ${title.slice(0, 80)}`,
    detail: policy.reason,
    decision: policy.decision,
    status: status === "approved" ? "success" : "waiting",
    metadata: { draftId: inserted?.id, qa: qa.evaluation.outcome, mode },
  });

  if (
    status === "approved" &&
    inserted &&
    (effectiveType === "new_blog" || effectiveType === "new_page") &&
    policy.decision === "AUTO_EXECUTE"
  ) {
    const raw = kw || title.replace(/^(Blog|Page):\s*/i, "");
    const base = slugify(raw);
    const slug = effectiveType === "new_page" ? base : `blog/${base}`;
    const { title: cleanTitle, meta: cleanMeta, body: cleanBody } = splitFrontMatter(body, title);
    await db.from("content").upsert(
      contentPublishFields({
        slug,
        brandId: brand.id,
        title: cleanTitle,
        body: cleanBody,
        metaDescription: cleanMeta,
      }),
      { onConflict: "brand_id,slug" }
    );
    // Live proof happens in stepPublish. Do not mark the draft published from
    // the in-platform store alone.
    if (publishTarget.ok && publishTarget.adapter.capabilities.includes("upsert_page")) {
      await enqueue(brand.id, "publish", { draftId: inserted.id, runId, agentTaskId });
    }
  }

  // Hybrid/Autopilot meta: pick option 0 explicitly (audited) when auto-publishing.
  // toSiteChange refuses missing metaChoice by design — autopilot must choose.
  if (
    status === "approved" &&
    inserted &&
    effectiveType === "fix_meta" &&
    policy.decision === "AUTO_EXECUTE" &&
    publishTarget.ok &&
    publishTarget.adapter.capabilities.includes("update_meta")
  ) {
    await enqueue(brand.id, "publish", {
      draftId: inserted.id,
      runId,
      agentTaskId,
      metaChoice: 0,
      autoSelectedMeta: true,
    });
    await recordActivity({
      brandId: brand.id,
      runId,
      capability: "content",
      eventType: "auto_meta_selected",
      title: `Auto-selected meta option 0 for ${effectiveUrl || title}`,
      detail: "Hybrid/Autopilot chose the first generated title/meta option.",
      status: "info",
      metadata: { draftId: inserted.id, metaChoice: 0 },
    });
  }

  if (agentTaskId) {
    await updateAgentTask(brand.id, agentTaskId, {
      status: qa.evaluation.outcome === "BLOCK" ? "blocked" : "done",
      finished_at: new Date().toISOString(),
      result_summary: `${policy.decision} / QA ${qa.evaluation.outcome}`,
      revision_count: qa.evaluation.outcome === "REVISE" ? 1 : 0,
    });
  }
}

export async function stepGeo(brand: Brand, payload: Record<string, unknown> = {}) {
  // A gap raised by the AI-visibility sweep names the exact question an
  // assistant answered without us (lib/ai-visibility/analyst.ts). That is a
  // targeted request, so it deliberately bypasses the once-per-brand guard
  // below — the guard exists to stop the generic FAQ being written over and
  // over, not to stop us answering a specific question we are losing.
  const focusQuestion = typeof payload.question === "string" ? payload.question : null;

  if (!focusQuestion) {
    const { count } = await db.from("drafts").select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id).eq("task_type", "geo_answers");
    if (count) return;
  } else {
    // Do not answer the same question twice: one draft per prompt key.
    const promptKey = typeof payload.prompt_key === "string" ? payload.prompt_key : null;
    if (promptKey) {
      const { count } = await db.from("drafts").select("id", { count: "exact", head: true })
        .eq("brand_id", brand.id).eq("task_type", "geo_answers").ilike("title", `%${promptKey}%`);
      if (count) return;
    }
  }

  const a = await writeAnswerContent(brand, focusQuestion ? { question: focusQuestion } : undefined);
  if (a?.faqs?.length) {
    const auto = isSectionAutopilot(brand, "content");
    const promptKey = typeof payload.prompt_key === "string" ? payload.prompt_key : null;
    await db.from("drafts").insert({
      brand_id: brand.id, task_type: "geo_answers",
      title: focusQuestion
        // The prompt key is carried in the title so the duplicate check above
        // can find it; drafts has no column for a prompt reference.
        ? `AI-answer: "${focusQuestion}"${promptKey ? ` [${promptKey}]` : ""}`
        : "AI-answer FAQ content (GEO/AEO)",
      body: a.faqs.map((f) => `**${f.q}**\n\n${f.a}`).join("\n\n"),
      rationale: (typeof payload.rationale === "string" && payload.rationale)
        || "Answer-optimized so ChatGPT/Gemini recommend the business.",
      status: auto ? "approved" : "pending_review",
    });
  }
}

export async function stepGbp(brand: Brand) {
  const post = await draftGbpPost(brand);
  if (!post) return;
  const auto = isSectionAutopilot(brand, "google_posts");
  await db.from("gbp_posts").insert({
    brand_id: brand.id,
    title: post.title,
    body: post.body,
    cta: post.cta,
    // Autopilot: accepted without sitting in the review queue.
    status: auto ? "approved" : "pending_review",
  });
}

export async function stepCitations(brand: Brand) {
  const { count } = await db.from("citations").select("id", { count: "exact", head: true }).eq("brand_id", brand.id);
  if (count) return;
  const cites = await findCitations(brand);
  if (!cites?.length) return;
  const auto = isSectionAutopilot(brand, "backlinks");
  await db.from("citations").insert(cites.map((c) => ({
    brand_id: brand.id,
    name: c.name,
    url: c.url,
    category: c.category,
    priority: c.priority,
    rationale: c.rationale,
    // Autopilot accepts the opportunity list; still tracked as live outreach items.
    status: auto ? "live" : "suggested",
  })));
}

export async function stepPerformance(brand: Brand) {
  await safe(() => analysePerformance(brand));
  await safe(() => reportOutcomes(brand));
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

  // Phase 8B: audit what the page actually says, not its pre-JS shell. Gated
  // so a future plan tier can disable rendering without changing this step.
  const result = await safe(() => auditSite(brand, 12, { render: canUse(brand, "js_rendering") }));
  const audited = (result as { audited?: number } | null)?.audited || 0;
  const issues = (result as { issues?: { url: string; problem: string; severity: string; fix: string; task_type: string }[] } | null)?.issues || [];
  const pages = (result as { pages?: AuditedPage[] } | null)?.pages || [];

  // Sprint 7: persist the auditor's per-page output so the Technical SEO
  // module reads a real dataset instead of a value that only ever existed at
  // runtime. One row per page per run, so history accumulates.
  //
  // Best-effort by design: written inside safe() so a brand whose database
  // hasn't had supabase/010_page_audits.sql applied yet still completes its
  // audit exactly as before. Same convention lib/queue.ts uses for its
  // optional observability columns.
  if (pages.length) {
    const runAt = new Date().toISOString();
    await safe(async () =>
      await db.from("page_audits").insert(
        pages.map((p) => ({
          brand_id: brand.id,
          url: p.url,
          http_status: p.status,
          title: p.title || null,
          meta_description: p.meta || null,
          h1: p.h1 || null,
          canonical: p.canonical || null,
          robots_meta: p.robots || null,
          word_count: p.words,
          fetched_at: runAt,
          audit_run_at: runAt,
        }))
      )
    );
  }

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
export async function runJob(job: { id?: string; brand_id: string; kind: JobKind; payload: Record<string, unknown> }) {
  const b = (await getBrandById(job.brand_id)) as Brand | null;
  if (!b) return;
  switch (job.kind) {
    case "plan": return void (await stepPlan(b));
    case "content": return void (await stepContent(b, job.payload));
    case "geo": return void (await stepGeo(b, job.payload));
    case "gbp": return void (await stepGbp(b));
    case "citations": return void (await stepCitations(b));
    case "audit": return void (await stepAudit(b, (job.payload.runId as string) || ""));
    case "performance": return void (await stepPerformance(b));
    case "rank_sync": return void (await stepRankSync(b));
    case "rank_enrich": return void (await stepRankEnrich(b));
    case "ai_visibility": return void (await stepAiVisibility(b));
    case "publish": return void (await stepPublish(b, job.payload));
    case "certify": return void (await stepCertify(b, { ...job.payload, jobId: job.id }));
  }
}

// PUBLISH: apply one approved draft to the brand's live site.
//
// This is the only step that changes something outside this platform, so it is
// deliberately strict: it re-reads the draft at execution time (never trusting
// a payload snapshot), re-validates that the draft is publishable, and throws
// on failure so the job is recorded as `failed` with a readable reason rather
// than silently reporting success. All platform specifics live behind
// lib/execution — this function names no platform.
export async function stepPublish(brand: Brand, payload: Record<string, unknown>) {
  const draftId = payload.draftId as string | undefined;
  if (!draftId) throw new Error("stepPublish: draftId is required");

  const { data: draft } = await db
    .from("drafts")
    .select("id, brand_id, task_type, title, body, target_url, target_keyword, status")
    .eq("id", draftId)
    .single();

  if (!draft) throw new Error(`stepPublish: draft ${draftId} not found`);
  // Tenant guard at the point of action, not just at the API boundary: this
  // job writes to a real website, so a mismatched brand must never proceed.
  if (draft.brand_id !== brand.id) {
    throw new Error(`stepPublish: draft ${draftId} does not belong to ${brand.slug}`);
  }
  if (draft.status === "dismissed") {
    throw new Error(`stepPublish: draft ${draftId} was dismissed and must not be published`);
  }

  // Feature 01: policy + latest QA gate before any live-site change.
  const latestQa = await safe(async () => {
    const { data } = await db
      .from("agent_qa_results")
      .select("outcome")
      .eq("brand_id", brand.id)
      .eq("draft_id", draftId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.outcome as "PASS" | "REVISE" | "BLOCK" | undefined;
  });
  const publishTarget = await resolvePublishTarget(brand.id);
  const mode = resolveExecutionMode(brand);
  const actionType = (draft.task_type as ProposedActionType) || "new_page";
  const humanApproved = draft.status === "approved" || draft.status === "published";
  const liveOp = capabilityForTaskType(draft.task_type);
  const policy = decidePolicy({
    brandId: brand.id,
    mode,
    autopilotEnabled: brand.autopilot_enabled !== false,
    actionType,
    riskLevel: draft.task_type === "fix_meta" ? "low" : "medium",
    confidence: 0.7,
    // Human-approved drafts: treat missing QA as PASS for policy purposes only
    // when a human already approved. Autopilot jobs must have linked QA PASS.
    qaOutcome: latestQa || (humanApproved ? "PASS" : null),
    adapterAvailable: publishTarget.ok,
    reversible: draft.task_type === "fix_meta",
    withinRunLimits: true,
    requiresLivePublish: true,
    operationCertified: liveOp ? isOperationAutopilotReady(brand, liveOp) : false,
  });

  // BLOCK always stops. Autopilot AUTO_EXECUTE without linked QA PASS stops.
  if (policy.decision === "BLOCK" || latestQa === "BLOCK") {
    await recordActivity({
      brandId: brand.id,
      capability: "qa_critic",
      eventType: "publish_blocked",
      title: `Publish blocked for draft ${draftId}`,
      detail: policy.reason,
      decision: policy.decision,
      status: "blocked",
    });
    throw new Error(`stepPublish: blocked by policy/QA — ${policy.reason}`);
  }
  if (!humanApproved && policy.decision !== "AUTO_EXECUTE") {
    throw new Error(`stepPublish: draft ${draftId} is not approved`);
  }
  // Autopilot path must have an explicit QA PASS row linked to the draft.
  if (!humanApproved && latestQa !== "PASS") {
    throw new Error(`stepPublish: autopilot publish requires linked QA PASS for draft ${draftId}`);
  }

  const metaChoice = typeof payload.metaChoice === "number" ? payload.metaChoice : undefined;
  const translation = toSiteChange(draft as DraftLike, brand.name, metaChoice);
  if (!translation.publishable) {
    throw new Error(`stepPublish: ${translation.reason}`);
  }

  const outcome = await executeChange(brand, translation.change, { draftId, jobId: (payload.jobId as string) || null });

  if (outcome.status === "failed") {
    throw new Error(`stepPublish: ${outcome.error}`);
  }

  const change = translation.change;
  const liveUrl =
    outcome.url ||
    (change.type === "upsert_page"
      ? absolutePageUrl(brand.site_url, change.slug)
      : change.type === "update_meta"
        ? change.url
        : null);
  if (!liveUrl) {
    throw new Error("stepPublish: write succeeded but no live address was returned to verify.");
  }

  const verified = await checkPublishedPage(
    brand,
    {
      url: liveUrl,
      changeType: change.type,
      title: change.type === "delete_page" ? null : change.title,
      keyword: draft.target_keyword,
      bodySnippet: change.type === "upsert_page" ? expectedSnippet(change.bodyMarkdown) : null,
      metaDescription: change.type === "update_meta" ? change.metaDescription : null,
    },
    { attempts: 3, delayMs: 2000 }
  );
  if (!verified.ok) {
    throw new Error(`stepPublish: live site does not show the change — ${verified.reason}`);
  }

  await db.from("drafts").update({ status: "published" }).eq("id", draftId);

  // A verified, live site change is exactly what seo_action_events was built to
  // mark on position-history charts. /api/intelligence/action logs an event when
  // work is QUEUED; this logs one when a change actually reached the site, which
  // is the event that can move a ranking.
  await safe(async () => {
    const { data: kw } = draft.target_keyword
      ? await db.from("tracked_keywords").select("id")
          .eq("brand_id", brand.id).eq("keyword", draft.target_keyword).maybeSingle()
      : { data: null };

    return await db.from("seo_action_events").insert({
      brand_id: brand.id,
      keyword_id: kw?.id || null,
      page_url: outcome.url || draft.target_url || null,
      event_type: translation.change.type === "upsert_page" ? "content_update" : "meta_update",
      event_label: `Published to ${outcome.platform}`,
      event_detail: draft.title,
      occurred_at: new Date().toISOString(),
    });
  });

  console.log(`[stepPublish] ${brand.slug}: ${translation.change.type} → ${outcome.platform} ${outcome.url || "(no url reported)"}`);
  return { published: true, platform: outcome.platform, url: outcome.url };
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
  const rows = await fullKeywordSync(brand.gsc_property).catch(() => []);
  if (!rows.length) return { skipped: "no GSC data" };

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
  // A keyword can rank on more than one landing page (GSC's ["query","page"]
  // dimensions), but keyword_positions is unique on (brand_id, keyword,
  // captured_date) -- landing_page isn't part of the key. Collapse to one
  // row per keyword per day here, keeping the row with the best (lowest)
  // position and its own landing_page/clicks/impressions/ctr together.
  const bestByKeyword = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!kwIdMap.has(r.keyword)) continue;
    const best = bestByKeyword.get(r.keyword);
    if (!best || r.position < best.position) {
      bestByKeyword.set(r.keyword, r);
    }
  }
  const positionRows = [...bestByKeyword.values()].map((r) => ({
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

  const { error: distError } = await db.from("position_distribution_snapshots").upsert(dist, {
    onConflict: "brand_id,captured_date",
  });
  if (distError) {
    throw new Error(`stepRankSync: position_distribution_snapshots upsert failed: ${distError.message}`);
  }

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
  // Without this, a missing DATAFORSEO_LOGIN/PASSWORD makes every DataForSEO
  // call below silently return null/[] (lib/dataforseo.ts's post()), and the
  // upsert loop still stamps enriched_at on every keyword regardless -- the
  // job "succeeds" while writing nothing but the timestamp, which then hides
  // those keywords from re-enrichment for another 7 days. Fail loudly instead
  // so this surfaces as a real job error.
  if (!isConfigured()) {
    throw new Error("stepRankEnrich: DataForSEO is not configured (DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD missing)");
  }

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
  const volumeMap = new Map(volumeData.map((v) => [v.keyword.toLowerCase(), v]));

  // --- DataForSEO: difficulty (unverified endpoint, fails gracefully) ---
  const difficultyData = await keywordDifficulty(keywords, geo).catch(() => []);
  const difficultyMap = new Map(
    difficultyData.map((d) => [d.keyword.toLowerCase(), d.difficulty])
  );

  // --- DataForSEO: intent (unverified endpoint, fails gracefully) ---
  const intentData = await classifySearchIntent(keywords, geo).catch(() => []);
  const intentMap = new Map(intentData.map((i) => [i.keyword.toLowerCase(), i.intent]));

  // --- AI opportunity scoring (Claude) ---
  // Process in a single batch prompt for efficiency
  const kwContext = toEnrich.map((k) => ({
    keyword: k.keyword,
    position: k.best_position,
    volume: volumeMap.get(k.keyword.toLowerCase())?.volume ?? null,
    difficulty: difficultyMap.get(k.keyword.toLowerCase()) ?? null,
    intent: intentMap.get(k.keyword.toLowerCase()) ?? null,
    status: k.status,
  }));

  // Scoring 50 keywords is a large reasoning task. On current models thinking
  // is ON by default and is billed against the SAME max_tokens as the answer,
  // so the previous {maxTokens: 2000, no thinking config} spent the entire
  // budget on thinking and returned zero text blocks -- extractJSON then got
  // "" and every ai_opportunity_score silently stayed null. Disabling thinking
  // makes the whole budget available to the JSON and is measurably cheaper and
  // faster here, with equivalent scores. The prompt and scoring rubric below
  // are unchanged.
  let scoringError: string | null = null;
  const aiText = await callClaude({
    maxTokens: 8000,
    thinking: { type: "disabled" },
    user: `You are an SEO strategist for a local service business.

BUSINESS: ${brand.name} — ${brand.services} in ${brand.service_area}.

Score each keyword 0-100 for opportunity (100 = highest priority to work on now).
Factors: local relevance, commercial intent, achievable position improvement, search volume vs difficulty.
Penalize: already ranking top 3, zero volume, purely informational intent for service businesses.

Keywords to score:
${JSON.stringify(kwContext, null, 2)}

Return ONLY JSON array:
[{"keyword":"...","score":0-100,"reason":"one sentence why"}]`,
  }).catch((err) => {
    // Previously `.catch(() => null)` -- the reason was thrown away and the
    // job reported success while writing no scores at all.
    scoringError = `model call failed: ${err instanceof Error ? err.message : String(err)}`;
    return null;
  });

  let aiScores = extractJSON<{ keyword: string; score: number; reason: string }[]>(aiText || "") || [];

  if (!scoringError) {
    if (!aiText) scoringError = "model returned no text (see [callClaude] EMPTY TEXT above for stop_reason and token split)";
    else if (!Array.isArray(aiScores) || aiScores.length === 0) {
      scoringError = `could not parse a score array from ${aiText.length} chars of model output`;
    }
  }

  // Only keep entries that carry a real, in-range score. Anything malformed is
  // dropped rather than written, so a bad row leaves the column null instead of
  // storing a junk value.
  const usable = (Array.isArray(aiScores) ? aiScores : []).filter(
    (s) => s && typeof s.keyword === "string" && typeof s.score === "number"
      && Number.isFinite(s.score) && s.score >= 0 && s.score <= 100
  );
  if (!scoringError && usable.length < aiScores.length) {
    console.warn(`[stepRankEnrich] ${brand.slug}: dropped ${aiScores.length - usable.length} malformed score row(s)`);
  }
  aiScores = usable;

  if (scoringError) {
    // Loud and specific. Enrichment still continues: volume, difficulty and
    // intent are independent of scoring and are worth persisting either way.
    console.error(
      `[stepRankEnrich] ${brand.slug}: ai_opportunity_score NOT computed for ${toEnrich.length} keyword(s) — ${scoringError}`
    );
  } else {
    console.log(`[stepRankEnrich] ${brand.slug}: scored ${aiScores.length}/${toEnrich.length} keyword(s)`);
  }

  const aiMap = new Map(aiScores.map((s) => [s.keyword.toLowerCase(), s]));

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
    const key = kw.keyword.toLowerCase();
    const vol = volumeMap.get(key);
    const volume = vol?.volume ?? kw.search_volume;
    const ai = aiMap.get(key);

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
      keyword_difficulty: difficultyMap.get(key) ?? undefined,
      search_intent: intentMap.get(key) ?? undefined,
      ai_opportunity_score: ai?.score ?? undefined,
      ai_opportunity_reason: ai?.reason ?? undefined,
      estimated_monthly_clicks: estimatedClicks ?? undefined,
      estimated_revenue_impact: revenueImpact,
      enriched_at: now,
    }).eq("id", kw.id);
  }

  return { enriched: toEnrich.length, scored: aiScores.length, scoring_error: scoringError };
}
