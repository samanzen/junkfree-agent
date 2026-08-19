"use client";
import { useEffect, useMemo, useState } from "react";
import Field from "@/app/_components/Field";
import {
  RECOMMENDATION_SECTIONS,
  isSectionAutopilot,
  readAutopilotMap,
  sectionForTaskType,
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

type RecTab = RecommendationSection | "issues" | "opportunities";

const LABEL: Record<string, string> = {
  fix_meta: "meta / intent",
  improve_content: "content audit",
  new_page: "new page",
  new_blog: "new blog",
  geo_answers: "AI-answer (GEO)",
};

const ACTION_TABS: { key: RecTab; label: string; blurb: string; tone: string }[] = [
  {
    key: "issues",
    label: "Issues",
    blurb: "Searches that slipped — ask the AI to fix them. Work comes back as Content drafts.",
    tone: "issue",
  },
  {
    key: "opportunities",
    label: "Almost page 1",
    blurb: "Searches sitting just off page 1 — ask the AI to push them.",
    tone: "opp",
  },
];

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

function isDraftSection(tab: RecTab): tab is RecommendationSection {
  return tab !== "issues" && tab !== "opportunities";
}

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
  const draftSections = RECOMMENDATION_SECTIONS.filter((s) => !s.localOnly || isLocal);
  const tabs: { key: RecTab; label: string; blurb: string; tone?: string }[] = [
    ...ACTION_TABS,
    ...draftSections.map((s) => ({ key: s.key as RecTab, label: s.label, blurb: s.blurb })),
  ];
  const [section, setSection] = useState<RecTab>("issues");
  const [issueCount, setIssueCount] = useState(0);
  const [oppCount, setOppCount] = useState(0);
  const autopilot = readAutopilotMap(brand);
  const sectionAuto = isDraftSection(section) ? isSectionAutopilot(brand, section) : false;

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

  const active = tabs.find((s) => s.key === section);
  const sectionDrafts =
    section === "pages" ? pageDrafts : section === "content" ? contentDrafts : section === "meta" ? metaDrafts : [];

  return (
    <div className="rec">
      <div className="rec-head">
        <div>
          <h2 className="rec-title">AI Recommendations</h2>
          <p className="rec-sub">
            All actions live here — fix slipping keywords, push almost-page-1 terms, and approve what agents drafted.
            Reports stay read-only.
          </p>
        </div>
        {isDraftSection(section) && (
          <button
            type="button"
            className={`rec-auto ${sectionAuto ? "on" : ""}`}
            onClick={() => onToggleSectionAutopilot(section, !sectionAuto)}
          >
            {sectionAuto ? "◉ Autopilot" : "◎ Manual approval"}
          </button>
        )}
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
            {isDraftSection(s.key) && autopilot[s.key] ? <span className="rec-pill">Auto</span> : null}
          </button>
        ))}
      </div>

      <p className="rec-blurb">
        {active?.blurb}{" "}
        {isDraftSection(section)
          ? sectionAuto
            ? "Autopilot is on for this tab."
            : "Manual approval is on for this tab."
          : null}
      </p>

      {(section === "issues" || section === "opportunities") && (
        <RecommendationActions brandId={brand.id} mode={section} />
      )}

      {isDraftSection(section) && section !== "google_posts" && section !== "backlinks" && (
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
              {feedbackFor === d.id && (
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
              title={`No ${active?.label.toLowerCase()} waiting`}
              body="Run the agents to generate recommendations for this tab."
              action={{ label: running ? "Running…" : "Run agents now", onClick: onRunAgents, disabled: running }}
            />
          )}
        </>
      )}

      {section === "google_posts" && (
        <>
          {pendingGbp.map((g) => (
            <article className="card" key={g.id}>
              <div className="meta">
                <span className="kind">google business post</span>
              </div>
              <h3>{g.title}</h3>
              <DraftBody body={g.body} />
              <p className="why">Call to action: {g.cta}</p>
              <div className="acts">
                <button className="primary" onClick={() => onRowAct("gbp_posts", g.id, "approved")}>
                  Approve
                </button>
                <button className="ghost" onClick={() => onRowAct("gbp_posts", g.id, "dismissed")}>
                  Decline
                </button>
              </div>
            </article>
          ))}
          {pendingGbp.length === 0 && (
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
              <div className="acts">
                <button className="primary" onClick={() => onRowAct("citations", c.id, "live")}>
                  Approve
                </button>
                <button className="ghost" onClick={() => onRowAct("citations", c.id, "skipped")}>
                  Decline
                </button>
              </div>
            </article>
          ))}
          {pendingCites.length === 0 && (
            <Empty
              icon="🔗"
              title="No backlink opportunities waiting"
              body="Citation opportunities appear here ranked by value — or Autopilot can accept them automatically."
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
.rec-auto { border:1px solid var(--line); background:var(--surface); color:var(--muted); border-radius:var(--radius-sm); padding:8px 14px; font-family:var(--font-mono); font-size:12px; cursor:pointer; }
.rec-auto.on { background:rgba(139,92,246,.12); border-color:rgba(139,92,246,.35); color:var(--violet); }
.rec-tabs { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:10px; }
.rec-tab { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line); background:var(--surface); color:var(--muted); border-radius:var(--radius-full); padding:7px 12px; font-size:12.5px; font-weight:600; cursor:pointer; }
.rec-tab.on { background:rgba(108,92,231,.1); border-color:rgba(108,92,231,.35); color:#6C5CE7; }
.rec-tab.issue.on { background:rgba(225,75,75,.1); border-color:rgba(225,75,75,.35); color:#C0392B; }
.rec-tab.opp.on { background:rgba(0,184,148,.12); border-color:rgba(0,184,148,.35); color:#00856B; }
.rec-count { font-family:var(--font-mono); font-size:11px; background:var(--surface2,#F3F5F8); color:var(--muted); padding:1px 7px; border-radius:var(--radius-full); }
.rec-tab.on .rec-count { background:rgba(108,92,231,.15); color:#6C5CE7; }
.rec-tab.issue.on .rec-count { background:rgba(225,75,75,.15); color:#C0392B; }
.rec-tab.opp.on .rec-count { background:rgba(0,184,148,.18); color:#00856B; }
.rec-pill { font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#8B5CF6; }
.rec-blurb { margin:0 0 14px; font-size:12.5px; color:var(--muted); }
.rec-action-intro { margin:0 0 12px; font-size:13px; color:#4A5568; line-height:1.5; }
.rec-action-loading,.rec-action-empty { padding:28px; text-align:center; color:#8A93A6; font-size:13px; background:#fff; border:1px dashed #E7EAF0; border-radius:var(--radius-md); }
.rec-action-list { display:flex; flex-direction:column; gap:10px; }
.rec-action-card { display:flex; justify-content:space-between; gap:14px; align-items:center; background:#fff; border:1px solid #E7EAF0; border-radius:var(--radius-md); padding:14px 16px; border-left:4px solid #CBD5E1; }
.rec-action-card.issues { border-left-color:#E17055; background:linear-gradient(90deg,#FFF8F6,#fff 40%); }
.rec-action-card.opportunities { border-left-color:#00B894; background:linear-gradient(90deg,#F3FFFB,#fff 40%); }
.rec-action-kw { font-size:14.5px; font-weight:700; color:#12172A; }
.rec-action-meta { font-size:12.5px; color:#6B768D; margin-top:3px; }
.rec-action-why { margin:6px 0 0; font-size:12.5px; color:#4F46E5; }
.rec-action-right { flex-shrink:0; }
`;
