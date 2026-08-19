"use client";
import { useEffect, useMemo, useState } from "react";
import Field from "@/app/_components/Field";
import {
  RECOMMENDATION_SECTIONS,
  isSectionAutopilot,
  readAutopilotMap,
  sectionForTaskType,
  sectionMeta,
  type RecommendationAutopilot,
  type RecommendationSection,
} from "@/lib/recommendations/sections";
import RecommendationActions from "./RecommendationActions";
import { authedFetch } from "@/lib/authedFetch";

type Draft = {
  id: string;
  brand_id: string;
  task_type: string;
  target_url: string | null;
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

type Props = {
  brand: BrandLike;
  isLocal: boolean;
  drafts: Draft[];
  gbp: Gbp[];
  citations: Cite[];
  running: boolean;
  busy: string;
  feedbackFor: string;
  feedbackText: string;
  onFeedbackFor: (id: string) => void;
  onFeedbackText: (v: string) => void;
  onDraftAct: (id: string, path: string) => void;
  onSendFeedback: (id: string) => void;
  onRowAct: (table: string, id: string, status: string) => void;
  onToggleSectionAutopilot: (section: RecommendationSection, enabled: boolean) => void;
  onRunAgents: () => void;
  DraftBody: React.ComponentType<{ body: string }>;
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
  running,
  busy,
  feedbackFor,
  feedbackText,
  onFeedbackFor,
  onFeedbackText,
  onDraftAct,
  onSendFeedback,
  onRowAct,
  onToggleSectionAutopilot,
  onRunAgents,
  DraftBody,
  Empty,
}: Props) {
  const tabs = RECOMMENDATION_SECTIONS.filter((s) => !s.localOnly || isLocal);
  const [section, setSection] = useState<RecommendationSection>(tabs[0]?.key || "issues");
  const [issueCount, setIssueCount] = useState(0);
  const [oppCount, setOppCount] = useState(0);
  const autopilot = readAutopilotMap(brand);
  const meta = sectionMeta(section);
  const doAuto = isSectionAutopilot(brand, section);

  useEffect(() => {
    let cancelled = false;
    authedFetch(`/api/intelligence/winners-losers?brand=${brand.id}&days=30`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setIssueCount((d.drops || []).length);
        setOppCount((d.almost_page_1 || []).length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brand.id]);

  const pageDrafts = useMemo(
    () => drafts.filter((d) => sectionForTaskType(d.task_type) === "pages"),
    [drafts]
  );
  const contentDrafts = useMemo(
    () => drafts.filter((d) => sectionForTaskType(d.task_type) === "content"),
    [drafts]
  );
  const metaDrafts = useMemo(
    () => drafts.filter((d) => sectionForTaskType(d.task_type) === "meta"),
    [drafts]
  );
  const pendingGbp = useMemo(
    () => gbp.filter((g) => g.status === "pending_review"),
    [gbp]
  );
  const pendingCites = useMemo(
    () =>
      citations.filter(
        (c) => c.status === "suggested" || c.status === "in_progress" || c.status === "pending_review"
      ),
    [citations]
  );

  const counts: Record<string, number> = {
    issues: issueCount,
    opportunities: oppCount,
    pages: pageDrafts.length,
    content: contentDrafts.length,
    meta: metaDrafts.length,
    google_posts: pendingGbp.length,
    backlinks: pendingCites.length,
  };

  const sectionDrafts =
    section === "pages" ? pageDrafts : section === "content" ? contentDrafts : section === "meta" ? metaDrafts : [];

  const isAction = section === "issues" || section === "opportunities";
  const isGbp = section === "google_posts";
  const isBacklinks = section === "backlinks";
  const isDraftTab = !isAction && !isGbp && !isBacklinks;

  return (
    <div className="rec">
      <div className="rec-head">
        <div>
          <h2 className="rec-title">AI Recommendations</h2>
          <p className="rec-sub">
            Everything you act on lives here. Pick a tab, then choose whether you review each item or the AI
            handles that tab automatically.
          </p>
        </div>
      </div>

      <div className="rec-tabs" role="tablist" aria-label="Recommendation types">
        {tabs.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={section === s.key}
            className={`rec-tab ${section === s.key ? "on" : ""} ${s.tone || ""}`}
            onClick={() => setSection(s.key)}
          >
            {s.label}
            <span className="rec-count">{counts[s.key] ?? 0}</span>
            {autopilot[s.key] ? <span className="rec-pill">Auto</span> : null}
          </button>
        ))}
      </div>

      <div className="rec-mode">
        <div className="rec-mode-copy">
          <div className="rec-mode-title">How should this tab work?</div>
          <p className="rec-mode-hint">{doAuto ? meta.autoHint : meta.manualHint}</p>
        </div>
        <div className="rec-mode-seg" role="group" aria-label="Tab mode">
          <button
            type="button"
            className={`rec-mode-btn ${!doAuto ? "on" : ""}`}
            onClick={() => onToggleSectionAutopilot(section, false)}
          >
            {meta.manualLabel}
          </button>
          <button
            type="button"
            className={`rec-mode-btn auto ${doAuto ? "on" : ""}`}
            onClick={() => onToggleSectionAutopilot(section, true)}
          >
            {meta.autoLabel}
          </button>
        </div>
      </div>

      <p className="rec-blurb">{meta.blurb}</p>

      {isAction && (
        <RecommendationActions brandId={brand.id} mode={section} doAutomatically={doAuto} />
      )}

      {isDraftTab && (
        <>
          {sectionDrafts.map((d) => (
            <article className="card" key={d.id}>
              <div className="meta">
                <span className="kind">{LABEL[d.task_type] || d.task_type}</span>
                <span className={`stat ${d.status}`}>{d.status.replace("_", " ")}</span>
              </div>
              <h3>{d.title}</h3>
              <p className="why">{d.rationale}</p>
              <DraftBody body={d.body} />
              {!doAuto && (
                <div className="acts">
                  {d.status === "pending_review" && (
                    <button className="primary" onClick={() => onDraftAct(d.id, "approve")}>
                      Approve &amp; publish
                    </button>
                  )}
                  {d.status === "approved" && (
                    <button className="primary" onClick={() => onDraftAct(d.id, "publish")}>
                      Publish
                    </button>
                  )}
                  <button className="ghost" onClick={() => onDraftAct(d.id, "approve?action=dismiss")}>
                    Decline
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      onFeedbackFor(feedbackFor === d.id ? "" : d.id);
                      onFeedbackText("");
                    }}
                  >
                    Give feedback
                  </button>
                </div>
              )}
              {doAuto && (
                <p className="rec-draft-auto">This tab is on <strong>Do automatically</strong> — new items of this type skip the queue.</p>
              )}
              {feedbackFor === d.id && !doAuto && (
                <div className="fb">
                  <Field
                    hideLabel
                    label="Feedback for the agent"
                    className="fb-input-wrap"
                    autoFocus
                    value={feedbackText}
                    disabled={busy === d.id}
                    onChange={(e) => onFeedbackText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSendFeedback(d.id);
                    }}
                    placeholder="Tell the agent what to change — shorter, different tone, add local detail…"
                  />
                  <button className="primary" onClick={() => onSendFeedback(d.id)} disabled={busy === d.id}>
                    {busy === d.id ? "Revising…" : "Send"}
                  </button>
                </div>
              )}
            </article>
          ))}
          {sectionDrafts.length === 0 && (
            <Empty
              icon="✦"
              title={`No ${meta.label.toLowerCase()} waiting`}
              body="Run the agents to generate recommendations for this tab."
              action={{ label: running ? "Running…" : "Run agents now", onClick: onRunAgents, disabled: running }}
            />
          )}
        </>
      )}

      {isGbp && (
        <>
          {pendingGbp.map((g) => (
            <article className="card" key={g.id}>
              <div className="meta">
                <span className="kind">google business post</span>
              </div>
              <h3>{g.title}</h3>
              <DraftBody body={g.body} />
              <p className="why">Call to action: {g.cta}</p>
              {!doAuto && (
                <div className="acts">
                  <button className="primary" onClick={() => onRowAct("gbp_posts", g.id, "approved")}>
                    Approve
                  </button>
                  <button className="ghost" onClick={() => onRowAct("gbp_posts", g.id, "dismissed")}>
                    Decline
                  </button>
                </div>
              )}
            </article>
          ))}
          {pendingGbp.length === 0 && (
            <Empty
              icon="📍"
              title="No Google posts waiting"
              body="Local SEO agents draft GBP posts here."
              action={{ label: running ? "Running…" : "Run agents now", onClick: onRunAgents, disabled: running }}
            />
          )}
        </>
      )}

      {isBacklinks && (
        <>
          {pendingCites.map((c) => (
            <article className="card row" key={c.id}>
              <div>
                <div className="meta">
                  <strong>{c.name}</strong>
                  <span className="kind">{c.category}</span>
                  <span className="prio">P{c.priority}</span>
                </div>
                <p className="why">{c.rationale}</p>
                {c.url && (
                  <a className="link" href={c.url} target="_blank" rel="noreferrer">
                    {c.url}
                  </a>
                )}
              </div>
              {!doAuto && (
                <div className="acts">
                  <button className="primary" onClick={() => onRowAct("citations", c.id, "live")}>
                    Approve
                  </button>
                  <button className="ghost" onClick={() => onRowAct("citations", c.id, "skipped")}>
                    Decline
                  </button>
                </div>
              )}
            </article>
          ))}
          {pendingCites.length === 0 && (
            <Empty
              icon="🔗"
              title="No backlink opportunities waiting"
              body="Citation opportunities appear here ranked by value."
              action={{ label: running ? "Running…" : "Run agents now", onClick: onRunAgents, disabled: running }}
            />
          )}
        </>
      )}

      <style>{REC_CSS}</style>
    </div>
  );
}

const REC_CSS = `
.rec-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:14px; flex-wrap:wrap; }
.rec-title { margin:0 0 4px; font-size:18px; letter-spacing:-.02em; }
.rec-sub { margin:0; color:var(--muted); font-size:13px; max-width:56ch; line-height:1.45; }
.rec-tabs { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:12px; }
.rec-tab { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line); background:var(--surface); color:var(--muted); border-radius:var(--radius-full); padding:7px 12px; font-size:12.5px; font-weight:600; cursor:pointer; }
.rec-tab.on { background:rgba(108,92,231,.1); border-color:rgba(108,92,231,.35); color:#6C5CE7; }
.rec-tab.issue.on { background:rgba(225,75,75,.1); border-color:rgba(225,75,75,.35); color:#C0392B; }
.rec-tab.opp.on { background:rgba(0,184,148,.12); border-color:rgba(0,184,148,.35); color:#00856B; }
.rec-count { font-family:var(--font-mono); font-size:11px; background:var(--surface2,#F3F5F8); color:var(--muted); padding:1px 7px; border-radius:var(--radius-full); }
.rec-tab.on .rec-count { background:rgba(108,92,231,.15); color:#6C5CE7; }
.rec-tab.issue.on .rec-count { background:rgba(225,75,75,.15); color:#C0392B; }
.rec-tab.opp.on .rec-count { background:rgba(0,184,148,.18); color:#00856B; }
.rec-pill { font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#00856B; background:rgba(0,184,148,.12); padding:2px 6px; border-radius:var(--radius-full); }
.rec-mode { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; background:linear-gradient(135deg,#F8FAFF,#F0FDFA); border:1px solid #E0E7FF; border-radius:var(--radius-md); padding:14px 16px; margin-bottom:12px; }
.rec-mode-title { font-size:13.5px; font-weight:700; color:#12172A; margin-bottom:4px; }
.rec-mode-hint { margin:0; font-size:12.5px; color:#4A5568; max-width:42ch; line-height:1.45; }
.rec-mode-seg { display:flex; background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-sm); padding:3px; gap:2px; }
.rec-mode-btn { border:0; background:transparent; color:#6B768D; padding:8px 14px; border-radius:var(--radius-xs); font-size:12.5px; font-weight:600; cursor:pointer; font-family:inherit; }
.rec-mode-btn.on { background:#EEF2FF; color:#4338CA; }
.rec-mode-btn.auto.on { background:#ECFDF5; color:#047857; }
.rec-blurb { margin:0 0 14px; font-size:12.5px; color:var(--muted); }
.rec-draft-auto { margin:12px 0 0; font-size:12.5px; color:#047857; background:#ECFDF5; border-radius:var(--radius-sm); padding:8px 10px; }
.rec-action-intro { margin:0 0 12px; font-size:13px; color:#4A5568; line-height:1.5; }
.rec-action-intro.auto { background:#ECFDF5; border:1px solid #A7F3D0; border-radius:var(--radius-sm); padding:10px 12px; color:#065F46; }
.rec-action-loading,.rec-action-empty { padding:28px; text-align:center; color:#8A93A6; font-size:13px; background:#fff; border:1px dashed #E7EAF0; border-radius:var(--radius-md); }
.rec-action-list { display:flex; flex-direction:column; gap:10px; }
.rec-action-card { display:flex; justify-content:space-between; gap:14px; align-items:center; background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:14px 16px; border-left:4px solid #CBD5E1; }
.rec-action-card.issues { border-left-color:#E17055; background:linear-gradient(90deg,#FFF8F6,#fff 40%); }
.rec-action-card.opportunities { border-left-color:#00B894; background:linear-gradient(90deg,#F3FFFB,#fff 40%); }
.rec-action-kw { font-size:14.5px; font-weight:700; color:#12172A; margin-bottom:8px; }
.rec-action-rank { margin:0 0 6px; }
.rec-action-vol { font-size:12px; color:#9AA3B2; margin-top:4px; }
.rec-action-why { margin:8px 0 0; font-size:12.5px; color:#4F46E5; line-height:1.4; }
.rec-action-right { flex-shrink:0; }
.rec-action-auto-badge { font-size:11.5px; font-weight:700; color:#047857; background:#ECFDF5; padding:6px 10px; border-radius:var(--radius-full); }
`;
