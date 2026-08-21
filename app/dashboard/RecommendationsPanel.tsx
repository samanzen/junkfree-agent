"use client";
import { useEffect, useMemo, useState } from "react";
import Field from "@/app/_components/Field";
import WorkPreview, { type WorkPreviewModel } from "@/app/_components/WorkPreview";
import DecisionReport from "@/app/_components/DecisionReport";
import { decisionWhy, displayWorkTitle, plannedPageUrl, type DecisionWhyInput, type KeywordFacts } from "@/lib/recommendations/preview";
import { uniqueByTopic, factsKey } from "@/lib/recommendations/topic";
import { matchesQueueFilter, QUEUE_FILTERS, type QueueFilter } from "@/lib/recommendations/queue";
import { useConfirm } from "@/app/_components/Notify";
import {
  RECOMMENDATION_SECTIONS,
  isSectionAutopilot,
  readAutopilotMap,
  sectionForTaskType,
  type RecommendationAutopilot,
  type RecommendationSection,
} from "@/lib/recommendations/sections";

type Draft = {
  id: string;
  brand_id: string;
  task_type: string;
  target_url: string | null;
  target_keyword?: string | null;
  title: string;
  body: string;
  rationale: string;
  status: string;
};
type Gbp = { id: string; brand_id: string; title: string; body: string; cta: string; status: string };
type Cite = {
  id: string;
  brand_id: string;
  name: string;
  url: string;
  category: string;
  priority: number;
  rationale: string;
  status: string;
};
type BrandLike = {
  id: string;
  name?: string;
  site_url?: string;
  auto_publish_meta?: boolean;
  recommendation_autopilot?: RecommendationAutopilot | null;
  business_model?: string;
};

const LABEL: Record<string, string> = {
  fix_meta: "meta / intent",
  improve_content: "content audit",
  new_page: "new page",
  new_blog: "new blog",
  geo_answers: "AI-answer (GEO)",
};

function factsFor(brandId: string | undefined, keyword: string | null | undefined, map: Record<string, KeywordFacts>): KeywordFacts | null {
  if (!brandId || !keyword) return null;
  return map[factsKey(brandId, keyword)] || null;
}

function IconApproveMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconDeclineMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

const DEFAULT_FILTERS: Record<RecommendationSection, QueueFilter> = {
  pages: "pending",
  content: "pending",
  meta: "pending",
  google_posts: "pending",
  backlinks: "pending",
};

type Props = {
  brand: BrandLike;
  isLocal: boolean;
  drafts: Draft[];
  gbp: Gbp[];
  citations: Cite[];
  keywordFacts?: Record<string, KeywordFacts>;
  running: boolean;
  busy: string;
  feedbackText: string;
  onFeedbackFor: (id: string) => void;
  onFeedbackText: (v: string) => void;
  onDraftAct: (id: string, path: string) => void;
  onSendFeedback: (id: string) => void;
  onRowAct: (table: string, id: string, status: string) => void;
  onToggleSectionAutopilot: (section: RecommendationSection, enabled: boolean) => void;
  onRunAgents: () => void;
  Empty: React.ComponentType<{
    icon: string;
    title: string;
    body: string;
    action?: { label: string; onClick: () => void; disabled?: boolean };
  }>;
};

export default function RecommendationsPanel({
  brand,
  isLocal,
  drafts,
  gbp,
  citations,
  keywordFacts = {},
  running,
  busy,
  feedbackText,
  onFeedbackFor,
  onFeedbackText,
  onDraftAct,
  onSendFeedback,
  onRowAct,
  onToggleSectionAutopilot,
  onRunAgents,
  Empty,
}: Props) {
  const sections = RECOMMENDATION_SECTIONS.filter((s) => !s.localOnly || isLocal);
  const [section, setSection] = useState<RecommendationSection>(sections[0]?.key || "pages");
  const [preview, setPreview] = useState<WorkPreviewModel | null>(null);
  const [previewId, setPreviewId] = useState<string>("");
  const [previewKind, setPreviewKind] = useState<"draft" | "gbp" | null>(null);
  const [whyId, setWhyId] = useState("");
  const [reportInput, setReportInput] = useState<DecisionWhyInput | null>(null);
  const [cardFeedbackId, setCardFeedbackId] = useState("");
  const [filters, setFilters] = useState<Record<RecommendationSection, QueueFilter>>(DEFAULT_FILTERS);
  const confirm = useConfirm();
  const autopilot = readAutopilotMap(brand);
  const sectionAuto = isSectionAutopilot(brand, section);
  const filter = filters[section] || "pending";

  useEffect(() => {
    if (previewKind !== "draft" || !previewId) return;
    const d = drafts.find((x) => x.id === previewId);
    if (!d) {
      setPreview(null);
      setPreviewId("");
      setPreviewKind(null);
      return;
    }
    setPreview({
      title: d.title,
      body: d.body,
      taskType: d.task_type,
      targetUrl: d.target_url,
      targetKeyword: d.target_keyword,
      rationale: d.rationale,
      plannedUrl: plannedPageUrl({
        taskType: d.task_type,
        title: d.title,
        targetUrl: d.target_url,
        targetKeyword: d.target_keyword,
        siteUrl: brand.site_url,
      }),
      facts: factsFor(brand.id, d.target_keyword, keywordFacts),
    });
  }, [drafts, previewId, previewKind, brand.site_url, brand.id, keywordFacts]);

  const pageDrafts = useMemo(
    () => uniqueByTopic(drafts.filter((d) => sectionForTaskType(d.task_type) === "pages")),
    [drafts]
  );
  const contentDrafts = useMemo(
    () => uniqueByTopic(drafts.filter((d) => sectionForTaskType(d.task_type) === "content")),
    [drafts]
  );
  const metaDrafts = useMemo(
    () => uniqueByTopic(drafts.filter((d) => sectionForTaskType(d.task_type) === "meta")),
    [drafts]
  );
  const gbpRows = useMemo(
    () => gbp.filter((g) => g.status === "pending_review" || g.status === "approved"),
    [gbp]
  );
  const citeRows = useMemo(
    () => citations.filter((c) => c.status !== "skipped"),
    [citations]
  );

  const counts: Record<RecommendationSection, number> = {
    pages: pageDrafts.filter((d) => matchesQueueFilter(d.status, "pending")).length,
    content: contentDrafts.filter((d) => matchesQueueFilter(d.status, "pending")).length,
    meta: metaDrafts.filter((d) => matchesQueueFilter(d.status, "pending")).length,
    google_posts: gbpRows.filter((g) => matchesQueueFilter(g.status, "pending", "post")).length,
    backlinks: citeRows.filter((c) => matchesQueueFilter(c.status, "pending", "citation")).length,
  };

  const activeBlurb = sections.find((s) => s.key === section)?.blurb || "";
  const sectionDrafts = (
    section === "pages" ? pageDrafts : section === "content" ? contentDrafts : section === "meta" ? metaDrafts : []
  ).filter((d) => matchesQueueFilter(d.status, filter));
  const shownGbp = gbpRows.filter((g) => matchesQueueFilter(g.status, filter, "post"));
  const shownCites = citeRows.filter((c) => matchesQueueFilter(c.status, filter, "citation"));

  async function declineDraft(id: string, title: string) {
    const ok = await confirm({
      title: "Decline this recommendation?",
      body: `“${title}” will leave the queue.`,
      confirmLabel: "Decline",
      cancelLabel: "Keep it",
      danger: true,
    });
    if (!ok) return;
    onDraftAct(id, "approve?action=dismiss");
    setPreview(null);
    setPreviewId("");
    setPreviewKind(null);
  }

  async function declineRow(table: string, id: string, status: string, title: string) {
    const ok = await confirm({
      title: "Decline this recommendation?",
      body: `“${title}” will leave the queue.`,
      confirmLabel: "Decline",
      cancelLabel: "Keep it",
      danger: true,
    });
    if (!ok) return;
    onRowAct(table, id, status);
    setPreview(null);
    setPreviewId("");
    setPreviewKind(null);
  }

  return (
    <div className="rec">
      <div className="rec-head">
        <div>
          <h2 className="rec-title">AI Recommendations</h2>
          <p className="rec-sub">
            Agents propose work here. Approve or decline — or turn Autopilot on for a tab so that type ships without waiting.
          </p>
        </div>
        <button
          type="button"
          className={`rec-auto ${sectionAuto ? "on" : ""}`}
          onClick={() => onToggleSectionAutopilot(section, !sectionAuto)}
          title={
            sectionAuto
              ? "Autopilot on for this tab — new items of this type skip the queue when safe."
              : "Manual approval — you review each item in this tab."
          }
        >
          {sectionAuto ? "◉ Autopilot" : "◎ Manual approval"}
        </button>
      </div>

      <div className="rec-tabs" role="tablist" aria-label="Recommendation types">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={section === s.key}
            className={`rec-tab ${section === s.key ? "on" : ""}`}
            onClick={() => setSection(s.key)}
          >
            {s.label}
            <span className="rec-count" aria-label={`${counts[s.key]} waiting`}>
              {counts[s.key]}
            </span>
            {autopilot[s.key] ? <span className="rec-pill">Auto</span> : null}
          </button>
        ))}
      </div>

      <div className="rec-subbar">
        <p className="rec-blurb">
          {activeBlurb}{" "}
          {sectionAuto
            ? "Autopilot is on for this tab."
            : "Manual approval is on for this tab."}
        </p>
        <Field
          as="select"
          hideLabel
          label="Show recommendations"
          className="rec-filter"
          value={filter}
          onChange={(e) => setFilters((prev) => ({ ...prev, [section]: e.target.value as QueueFilter }))}
        >
          {QUEUE_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Field>
      </div>

      {section !== "google_posts" && section !== "backlinks" && (
        <>
          {sectionDrafts.map((d) => {
            const href = plannedPageUrl({
              taskType: d.task_type,
              title: d.title,
              targetUrl: d.target_url,
              targetKeyword: d.target_keyword,
              siteUrl: brand.site_url,
            });
            const facts = factsFor(brand.id, d.target_keyword, keywordFacts);
            const whyInput = {
              kind: "draft" as const,
              taskType: d.task_type,
              title: d.title,
              keyword: d.target_keyword,
              url: d.target_url || href,
              rationale: d.rationale,
              body: d.body,
              facts,
            };
            const why = decisionWhy(whyInput);
            return (
              <article className="card" key={d.id}>
                <div className="meta">
                  <span className="kind">{LABEL[d.task_type] || d.task_type}</span>
                  <span className={`stat ${d.status}`}>{d.status.replace("_", " ")}</span>
                </div>
                <h3>{displayWorkTitle(d.title)}</h3>
                {href ? (
                  <a className="link" href={href} target="_blank" rel="noreferrer">{href}</a>
                ) : null}
                <div className="acts">
                  <button
                    className="primary"
                    onClick={() => {
                      setPreviewKind("draft");
                      setPreviewId(d.id);
                      setPreview({
                        title: d.title,
                        body: d.body,
                        taskType: d.task_type,
                        targetUrl: d.target_url,
                        targetKeyword: d.target_keyword,
                        rationale: d.rationale,
                        plannedUrl: href,
                        facts,
                      });
                      onFeedbackFor(d.id);
                      onFeedbackText("");
                    }}
                  >
                    Preview
                  </button>
                  <button
                    className="icon-ok"
                    aria-label="Approve"
                    title="Approve"
                    disabled={busy === d.id}
                    onClick={() => onDraftAct(d.id, d.status === "approved" ? "publish" : "approve")}
                  >
                    <IconApproveMark />
                  </button>
                  <button
                    className="icon-no"
                    aria-label="Decline"
                    title="Decline"
                    disabled={busy === d.id}
                    onClick={() => void declineDraft(d.id, displayWorkTitle(d.title))}
                  >
                    <IconDeclineMark />
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      const open = cardFeedbackId !== d.id;
                      setCardFeedbackId(open ? d.id : "");
                      setWhyId("");
                      onFeedbackFor(d.id);
                      if (open) onFeedbackText("");
                    }}
                  >
                    Feedback
                  </button>
                  {why && (
                    <button
                      className={`ghost${whyId === d.id ? " on" : ""}`}
                      aria-pressed={whyId === d.id}
                      onClick={() => { setWhyId(whyId === d.id ? "" : d.id); setCardFeedbackId(""); }}
                    >
                      Why
                    </button>
                  )}
                </div>
                {whyId === d.id && why && (
                  <div className="why">
                    {why}
                    <button type="button" className="why-more" onClick={() => setReportInput(whyInput)}>
                      Full report
                    </button>
                  </div>
                )}
                {cardFeedbackId === d.id && (
                  <div className="fb">
                    <Field
                      hideLabel
                      label="Feedback for the agent"
                      className="fb-input-wrap"
                      autoFocus
                      value={feedbackText}
                      disabled={busy === d.id}
                      onChange={(e) => onFeedbackText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") onSendFeedback(d.id); }}
                      placeholder="Tell the agent what to change…"
                    />
                    <button className="primary" disabled={busy === d.id} onClick={() => onSendFeedback(d.id)}>
                      {busy === d.id ? "Revising…" : "Send"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
          {sectionDrafts.length === 0 && (
            <Empty
              icon="✦"
              title={filter === "approved" ? "No approved items in this tab" : `No ${sections.find((s) => s.key === section)?.label.toLowerCase()} waiting`}
              body="Run the agents to generate recommendations for this tab."
              action={{ label: running ? "Running…" : "Run agents now", onClick: onRunAgents, disabled: running }}
            />
          )}
        </>
      )}

      {section === "google_posts" && (
        <>
          {shownGbp.map((g) => {
            const whyInput: DecisionWhyInput = { kind: "google_post", title: g.title, body: g.body };
            const why = decisionWhy(whyInput);
            return (
              <article className="card" key={g.id}>
                <div className="meta">
                  <span className="kind">google business post</span>
                </div>
                <h3>{g.title}</h3>
                <div className="acts">
                  <button
                    className="primary"
                    onClick={() => {
                      setPreviewKind("gbp");
                      setPreviewId(g.id);
                      setPreview({ title: g.title, body: g.body, taskType: "google_post", cta: g.cta });
                    }}
                  >
                    Preview
                  </button>
                  <button
                    className="icon-ok"
                    aria-label="Approve"
                    title="Approve"
                    disabled={busy === g.id}
                    onClick={() => onRowAct("gbp_posts", g.id, "approved")}
                  >
                    <IconApproveMark />
                  </button>
                  <button
                    className="icon-no"
                    aria-label="Decline"
                    title="Decline"
                    disabled={busy === g.id}
                    onClick={() => void declineRow("gbp_posts", g.id, "dismissed", g.title)}
                  >
                    <IconDeclineMark />
                  </button>
                  {why && (
                    <button
                      className={`ghost${whyId === g.id ? " on" : ""}`}
                      aria-pressed={whyId === g.id}
                      onClick={() => setWhyId(whyId === g.id ? "" : g.id)}
                    >
                      Why
                    </button>
                  )}
                </div>
                {whyId === g.id && why && (
                  <div className="why">
                    {why}
                    <button type="button" className="why-more" onClick={() => setReportInput(whyInput)}>
                      Full report
                    </button>
                  </div>
                )}
              </article>
            );
          })}
          {shownGbp.length === 0 && (
            <Empty
              icon="📍"
              title="No Google posts waiting"
              body="Local SEO agents draft GBP posts here for approval — or turn Autopilot on for this tab."
              action={{ label: running ? "Running…" : "Run agents now", onClick: onRunAgents, disabled: running }}
            />
          )}
        </>
      )}

      {section === "backlinks" && (
        <>
          {shownCites.map((c) => {
            const whyInput: DecisionWhyInput = {
              kind: "backlink",
              title: c.name,
              url: c.url,
              rationale: c.rationale,
            };
            const why = decisionWhy(whyInput);
            return (
              <article className="card row" key={c.id}>
                <div>
                  <div className="meta">
                    <strong>{c.name}</strong>
                    <span className="kind">{c.category}</span>
                    <span className="prio">P{c.priority}</span>
                  </div>
                  {c.url && (
                    <a className="link" href={c.url} target="_blank" rel="noreferrer">
                      {c.url}
                    </a>
                  )}
                  {whyId === c.id && why && (
                    <div className="why">
                      {why}
                      <button type="button" className="why-more" onClick={() => setReportInput(whyInput)}>
                        Full report
                      </button>
                    </div>
                  )}
                </div>
                <div className="acts">
                  <button
                    className="icon-ok"
                    aria-label="Approve"
                    title="Approve"
                    onClick={() => onRowAct("citations", c.id, "live")}
                  >
                    <IconApproveMark />
                  </button>
                  <button
                    className="icon-no"
                    aria-label="Decline"
                    title="Decline"
                    onClick={() => void declineRow("citations", c.id, "skipped", c.name)}
                  >
                    <IconDeclineMark />
                  </button>
                  {why && (
                    <button
                      className={`ghost${whyId === c.id ? " on" : ""}`}
                      aria-pressed={whyId === c.id}
                      onClick={() => setWhyId(whyId === c.id ? "" : c.id)}
                    >
                      Why
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {shownCites.length === 0 && (
            <Empty
              icon="🔗"
              title="No backlink opportunities waiting"
              body="Citation opportunities appear here ranked by value — or Autopilot can accept them automatically."
              action={{ label: running ? "Running…" : "Run agents now", onClick: onRunAgents, disabled: running }}
            />
          )}
        </>
      )}

      <WorkPreview
        open={!!preview}
        onClose={() => { setPreview(null); setPreviewId(""); setPreviewKind(null); }}
        brandName={brand.name || "Your business"}
        siteUrl={brand.site_url}
        work={preview}
        approveLabel={previewKind === "gbp" ? "Approve" : preview?.taskType && ["new_page", "new_blog", "geo_answers"].includes(preview.taskType) ? "Approve & publish" : "Approve"}
        busy={busy === previewId}
        onApprove={
          previewKind === "gbp"
            ? () => { onRowAct("gbp_posts", previewId, "approved"); setPreview(null); }
            : preview
              ? () => {
                  const d = drafts.find((x) => x.id === previewId);
                  onDraftAct(previewId, d?.status === "approved" ? "publish" : "approve");
                  setPreview(null);
                }
              : undefined
        }
        onDecline={
          previewKind === "gbp"
            ? () => { void declineRow("gbp_posts", previewId, "dismissed", preview?.title || "this post"); }
            : previewKind === "draft"
              ? () => { void declineDraft(previewId, preview?.title || "this recommendation"); }
              : undefined
        }
        feedback={previewKind === "draft" ? {
          value: feedbackText,
          onChange: onFeedbackText,
          onSend: () => onSendFeedback(previewId),
          sending: busy === previewId,
        } : undefined}
      />

      <DecisionReport
        open={!!reportInput}
        onClose={() => setReportInput(null)}
        input={reportInput}
      />

      <style>{REC_CSS}</style>
    </div>
  );
}

const REC_CSS = `
.rec-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:14px; flex-wrap:wrap; }
.rec-title { margin:0 0 4px; font-size:18px; letter-spacing:-.02em; }
.rec-sub { margin:0; color:var(--muted); font-size:13px; max-width:52ch; line-height:1.45; }
.rec-auto { border:1px solid var(--line); background:var(--surface); color:var(--muted); border-radius:var(--radius-sm); padding:8px 14px; font-family:var(--font-mono); font-size:12px; cursor:pointer; }
.rec-auto.on { background:rgba(139,92,246,.12); border-color:rgba(139,92,246,.35); color:var(--violet); }
.rec-tabs { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:10px; }
.rec-tab { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line); background:var(--surface); color:var(--muted); border-radius:999px; padding:7px 12px; font-size:12.5px; font-weight:600; cursor:pointer; }
.rec-tab.on { background:rgba(108,92,231,.1); border-color:rgba(108,92,231,.35); color:#6C5CE7; }
.rec-count { font-family:var(--font-mono); font-size:11px; background:var(--surface2,#F3F5F8); color:var(--muted); padding:1px 7px; border-radius:999px; }
.rec-tab.on .rec-count { background:rgba(108,92,231,.15); color:#6C5CE7; }
.rec-pill { font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#8B5CF6; }
.rec-blurb { margin:0; font-size:12.5px; color:var(--muted); }
.rec-subbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap; }
.rec-filter { min-width:168px; }
.rec .icon-ok, .rec .icon-no { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:var(--radius-sm); padding:0; cursor:pointer; }
.rec .icon-ok { background:#E8F8EF; border:1px solid #B7E4C7; color:#18794E; }
.rec .icon-ok:hover { background:#D4F0E0; }
.rec .icon-no { background:#FDECEC; border:1px solid #F5C2C2; color:#C0392B; }
.rec .icon-no:hover { background:#FAD4D4; }
.rec .icon-ok:disabled, .rec .icon-no:disabled { opacity:.55; cursor:default; }
.rec .link { display:block; margin:6px 0 4px; }
.rec .ghost.on { background:rgba(108,92,231,.1); border-color:rgba(108,92,231,.45); color:#6C5CE7; font-weight:600; }
.rec .acts + .why, .rec .acts + .fb { margin-top:12px; }
.rec .why { white-space:pre-wrap; max-width:68ch; }
.rec .why-more { display:inline-block; margin-top:10px; background:none; border:0; color:#6C5CE7; font:inherit; font-weight:600; font-size:13px; padding:0; cursor:pointer; }
.fb { display:flex; gap:8px; margin-top:12px; align-items:flex-end; }
.fb-input-wrap { flex:1; min-width:0; }
`;
