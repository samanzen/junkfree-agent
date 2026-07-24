// THE BRAIN.
// One run = gather signals -> decide the highest-value work -> execute it ->
// queue drafts. This is what makes the system autonomous: nobody tells it what
// to do; it looks at the site's real search performance and figures it out.

import { callClaude, extractJSON } from "./anthropic";
import { brandBlock } from "./brand";
import { db, TaskType } from "./supabase";
import { strikingDistance, lowCtrPages } from "./gsc";
import { writeContent, rewriteMeta, auditPage } from "./agents";

// How many pieces of work to actually execute per run. Keeps cost bounded and
// avoids flooding the site with content (a real spam-penalty risk if unchecked).
const MAX_TASKS_PER_RUN = Number(process.env.MAX_TASKS_PER_RUN || 4);
const AUTO_PUBLISH = process.env.AUTO_PUBLISH === "true";

type PlannedTask = {
  task_type: TaskType;
  target_url?: string;
  target_keyword?: string;
  rationale: string;
};

export async function runOrchestration() {
  // 1) Open a run record.
  const { data: run } = await db
    .from("runs")
    .insert({ status: "running" })
    .select()
    .single();
  const runId = run!.id;

  try {
    // 2) Gather live signals. If GSC isn't wired yet, degrade gracefully.
    const [striking, lowCtr] = await Promise.all([
      safe(strikingDistance),
      safe(lowCtrPages),
    ]);

    // 3) Ask the orchestrator model to turn signals into a ranked task list.
    const planText = await callClaude({
      maxTokens: 1500,
      user: `${brandBlock()}

You are the SEO operations lead. Below is this site's real Search Console data for the last 28 days. Decide the ${MAX_TASKS_PER_RUN} highest-impact actions to take right now. Prefer quick wins (striking-distance rankings, weak titles) over big new builds unless a content gap is glaring.

STRIKING DISTANCE (queries ranking 5-20 — small push = page 1):
${JSON.stringify(striking, null, 2)}

LOW CTR PAGES (ranking but not getting clicks — usually weak title/meta):
${JSON.stringify(lowCtr, null, 2)}

Return ONLY a JSON array of up to ${MAX_TASKS_PER_RUN} tasks:
[{"task_type":"fix_meta|improve_content|new_page|new_blog","target_url":"...optional","target_keyword":"...","rationale":"why this, in one line"}]`,
    });

    const tasks = (extractJSON<PlannedTask[]>(planText) || []).slice(0, MAX_TASKS_PER_RUN);

    // 4) Execute each task with the right specialist, store the deliverable.
    let produced = 0;
    for (const t of tasks) {
      const draft = await execute(t);
      if (!draft) continue;
      await db.from("drafts").insert({
        run_id: runId,
        task_type: t.task_type,
        target_url: t.target_url || null,
        target_keyword: t.target_keyword || null,
        title: draft.title,
        body: draft.body,
        rationale: t.rationale,
        status: AUTO_PUBLISH && t.task_type === "fix_meta" ? "approved" : "pending_review",
      });
      produced++;
    }

    await db
      .from("runs")
      .update({ status: "done", tasks_planned: tasks.length, drafts_produced: produced })
      .eq("id", runId);

    return { runId, planned: tasks.length, produced };
  } catch (err) {
    await db.from("runs").update({ status: "error", error: String(err) }).eq("id", runId);
    throw err;
  }
}

async function execute(t: PlannedTask): Promise<{ title: string; body: string } | null> {
  const kw = t.target_keyword || "";
  switch (t.task_type) {
    case "new_blog":
      return { title: `Blog: ${kw}`, body: await writeContent(kw, "Blog post") };
    case "new_page":
      return { title: `Page: ${kw}`, body: await writeContent(kw, "Local service page") };
    case "improve_content":
      return {
        title: `Audit + rewrite: ${t.target_url || kw}`,
        body: await auditPage(kw, ""),
      };
    case "fix_meta":
      return {
        title: `Meta rewrite: ${t.target_url || kw}`,
        body: await rewriteMeta(t.target_url || "", `Target keyword: ${kw}`),
      };
    default:
      return null;
  }
}

async function safe<T>(fn: () => Promise<T>): Promise<T | []> {
  try {
    return await fn();
  } catch {
    return [] as unknown as T; // GSC not configured yet — orchestrator still runs.
  }
}
