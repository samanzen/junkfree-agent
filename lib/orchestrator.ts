// THE BRAIN — now multi-tenant.
// One run loops over every active brand and, for each, does the full local-SEO
// suite: read GSC signals, plan content work, fix search intent, draft GBP posts,
// and surface citation/backlink opportunities. Safe fixes can auto-publish.

import { callClaude, extractJSON } from "./anthropic";
import { getActiveBrands, brandBlock, type Brand } from "./brands";
import { db, TaskType } from "./supabase";
import { strikingDistance, lowCtrPages, pagesByIntentSignal } from "./gsc";
import { writeContent, rewriteMeta, auditPage } from "./agents";
import { draftGbpPost, findCitations, fixIntent } from "./local-agents";
import { writeAnswerContent } from "./geo-agent";

const MAX_TASKS_PER_RUN = Number(process.env.MAX_TASKS_PER_RUN || 3);

type PlannedTask = {
  task_type: TaskType;
  target_url?: string;
  target_keyword?: string;
  rationale: string;
};

// Entry point: run every active brand. Returns a per-brand summary.
export async function runOrchestration() {
  const brands = await getActiveBrands();
  if (!brands.length) {
    throw new Error("No active brands found. Run supabase/platform.sql to seed brands.");
  }
  const results = [];
  for (const brand of brands) {
    try {
      results.push(await runBrand(brand));
    } catch (err) {
      results.push({ brand: brand.slug, error: String(err) });
    }
  }
  return { brands: results.length, results };
}

async function runBrand(brand: Brand) {
  const { data: run } = await db
    .from("runs")
    .insert({ status: "running", brand_id: brand.id })
    .select()
    .single();
  const runId = run!.id;
  let produced = 0;

  try {
    // 1) Gather live GSC signals (degrade gracefully if GSC not wired for a brand).
    const gsc = brand.gsc_property;
    const [striking, lowCtr, intentPages] = await Promise.all([
      gsc ? safe(() => strikingDistance(gsc)) : Promise.resolve([]),
      gsc ? safe(() => lowCtrPages(gsc)) : Promise.resolve([]),
      gsc && brand.intent_notes
        ? safe(() => pagesByIntentSignal(gsc, "free"))
        : Promise.resolve([]),
    ]);

    // 2) Plan the highest-value content work from the signals.
    const planText = await callClaude({
      maxTokens: 1500,
      user: `${brandBlock(brand)}

You are the SEO operations lead. Below is this site's real Search Console data (last 28 days). Decide the ${MAX_TASKS_PER_RUN} highest-impact actions right now. Prefer quick wins (striking-distance rankings, weak titles) over big new builds unless a content gap is glaring.

TARGETING RULES:
- Target PAID / high-commercial-intent keywords (cost, prices, hire, same-day, "[service] [city]").
- Do NOT create pages/blogs whose primary keyword contains "free" (it attracts wrong-intent, non-paying visitors) unless the explicit goal is to redirect that intent toward paid.

STRIKING DISTANCE (ranking 5-20 — small push = page 1):
${JSON.stringify(striking, null, 2)}

LOW CTR PAGES (ranking but few clicks — usually weak title/meta):
${JSON.stringify(lowCtr, null, 2)}

Return ONLY a JSON array of up to ${MAX_TASKS_PER_RUN} tasks:
[{"task_type":"fix_meta|improve_content|new_page|new_blog","target_url":"...optional","target_keyword":"...","rationale":"why, one line"}]`,
    });
    const tasks = (extractJSON<PlannedTask[]>(planText) || []).slice(0, MAX_TASKS_PER_RUN);

    // 3) Execute content tasks. Meta fixes can auto-publish if the brand allows.
    for (const t of tasks) {
      const draft = await execute(brand, t);
      if (!draft) continue;
      const autoApprove = brand.auto_publish_meta && t.task_type === "fix_meta";
      await db.from("drafts").insert({
        brand_id: brand.id,
        run_id: runId,
        task_type: t.task_type,
        target_url: t.target_url || null,
        target_keyword: t.target_keyword || null,
        title: draft.title,
        body: draft.body,
        rationale: t.rationale,
        status: autoApprove ? "approved" : "pending_review",
      });
      produced++;
    }

    // 4) INTENT FIXER — the "free" problem. Rewrite wrong-intent pages.
    for (const p of intentPages.slice(0, 2)) {
      const fix = await fixIntent(brand, p.page, p.queries);
      if (fix) {
        await db.from("drafts").insert({
          brand_id: brand.id,
          run_id: runId,
          task_type: "fix_meta",
          target_url: p.page,
          title: `Intent fix: ${p.page}`,
          body: fix,
          rationale: `Page attracts wrong-intent ("${p.queries[0]}") traffic — qualify for paying customers.`,
          status: "pending_review",
        });
        produced++;
      }
    }

    // 5) GBP POST — active Google Business Profile = stronger map-pack ranking.
    const post = await draftGbpPost(brand);
    if (post) {
      await db.from("gbp_posts").insert({
        brand_id: brand.id,
        title: post.title,
        body: post.body,
        cta: post.cta,
        status: "pending_review",
      });
      produced++;
    }

    // 6) GEO / AEO — answer-optimized FAQ content so AI assistants (ChatGPT,
    // Gemini) recommend this business. Refresh occasionally.
    const { count: geoCount } = await db
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("task_type", "geo_answers");
    if (!geoCount) {
      const answers = await writeAnswerContent(brand).catch(() => null);
      if (answers?.faqs?.length) {
        const md = answers.faqs.map((f) => `**${f.q}**\n\n${f.a}`).join("\n\n");
        await db.from("drafts").insert({
          brand_id: brand.id,
          run_id: runId,
          task_type: "geo_answers",
          title: "AI-answer FAQ content (GEO/AEO)",
          body: md,
          rationale: "Answer-optimized content so ChatGPT/Gemini recommend the business + FAQPage schema for snippets.",
          status: "pending_review",
        });
        produced++;
      }
    }

    // 7) CITATIONS — refresh only when the brand has few on file.
    const { count } = await db
      .from("citations")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id);
    if (!count) {
      const cites = await findCitations(brand);
      if (cites?.length) {
        await db.from("citations").insert(
          cites.map((c) => ({
            brand_id: brand.id,
            name: c.name,
            url: c.url,
            category: c.category,
            priority: c.priority,
            rationale: c.rationale,
          }))
        );
      }
    }

    await db
      .from("runs")
      .update({ status: "done", tasks_planned: tasks.length, drafts_produced: produced })
      .eq("id", runId);

    return { brand: brand.slug, planned: tasks.length, produced };
  } catch (err) {
    try {
      await db.from("runs").update({ status: "error" }).eq("id", runId);
    } catch {}
    return { brand: brand.slug, error: String(err) };
  }
}

async function execute(
  brand: Brand,
  t: PlannedTask
): Promise<{ title: string; body: string } | null> {
  const kw = t.target_keyword || "";
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  switch (t.task_type) {
    case "new_blog":
      return { title: `Blog: ${kw}`, body: await writeContent(brand, kw, "Blog post") };
    case "new_page":
      return { title: `Page: ${kw}`, body: await writeContent(brand, kw, "Local service page") };
    case "improve_content":
      return { title: `Audit + rewrite: ${t.target_url || kw}`, body: await auditPage(brand, kw, "") };
    case "fix_meta":
      return {
        title: `Meta rewrite: ${t.target_url || kw}`,
        body: await rewriteMeta(brand, t.target_url || "", `Target keyword: ${kw}`),
      };
    default:
      return null;
  }
}


async function safe<T>(fn: () => Promise<T>): Promise<T | []> {
  try {
    return await fn();
  } catch {
    return [] as unknown as T;
  }
}
