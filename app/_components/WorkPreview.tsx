"use client";
import { useRef, useState } from "react";
import { markdownToHtml } from "@/lib/execution/markdown";
import { useDialog } from "@/lib/ui/useDialog";
import Field from "@/app/_components/Field";
import {
  absolutizeMarkdownImages,
  decisionWhy,
  displayWorkTitle,
  firstMarkdownImage,
  metaFromBody,
  pageFromBody,
  plannedPageUrl,
  postTextWithoutImages,
  previewKindFor,
  resolvePreviewSrc,
  rewritePlanFromBody,
  type KeywordFacts,
  type PreviewKind,
} from "@/lib/recommendations/preview";

export type WorkPreviewModel = {
  title: string;
  body: string;
  taskType?: string;
  targetUrl?: string | null;
  targetKeyword?: string | null;
  cta?: string;
  rationale?: string | null;
  plannedUrl?: string | null;
  facts?: KeywordFacts | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  brandName: string;
  siteUrl?: string | null;
  work: WorkPreviewModel | null;
  onApprove?: () => void;
  onDecline?: () => void;
  approveLabel?: string;
  busy?: boolean;
  feedback?: {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    sending?: boolean;
  };
};

export default function WorkPreview({
  open, onClose, brandName, siteUrl, work, onApprove, onDecline,
  approveLabel = "Approve & publish", busy, feedback,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useDialog<HTMLDivElement>({ open, onClose, modal: true });
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (!open || !work) return null;

  const kind: PreviewKind = work.taskType === "google_post"
    ? "google_post"
    : previewKindFor(work.taskType || "new_page", work.body);
  const heading = displayWorkTitle(work.title);
  const href = work.plannedUrl || plannedPageUrl({
    taskType: work.taskType || "new_page",
    title: work.title,
    targetUrl: work.targetUrl,
    targetKeyword: work.targetKeyword,
    siteUrl,
  });
  const whyText = decisionWhy({
    kind: work.taskType === "google_post" ? "google_post" : "draft",
    taskType: work.taskType,
    title: work.title,
    keyword: work.targetKeyword,
    url: work.targetUrl || href,
    rationale: work.rationale,
    body: work.body,
    facts: work.facts,
  });

  return (
    <div className="wp-layer">
      <style>{WP_CSS}</style>
      {/* Scrim is presentational; the dialog owns Escape and the close button. */}
      <div className="wp-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="wp-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${heading}`}
      >
        <header className="wp-top">
          <div>
            <div className="wp-kicker">{kindLabel(kind)}</div>
            <div className="wp-top-title">{heading}</div>
            {href ? (
              <a className="wp-top-url" href={href} target="_blank" rel="noreferrer">{href}</a>
            ) : null}
          </div>
          <button ref={closeRef} type="button" className="wp-x" onClick={onClose} aria-label="Close preview">✕</button>
        </header>

        {whyText && (
          <div className="wp-why-block">
            <div className="wp-kicker">Why I queued this</div>
            <p className="wp-why">{whyText}</p>
          </div>
        )}

        <div className="wp-stage">
          {kind === "page" && <PageLook brandName={brandName} siteUrl={siteUrl} title={work.title} body={work.body} targetUrl={work.targetUrl || href} />}
          {kind === "meta" && <SerpLook brandName={brandName} siteUrl={siteUrl} title={work.title} body={work.body} targetUrl={work.targetUrl || href} />}
          {kind === "google_post" && (
            <GbpLook brandName={brandName} siteUrl={siteUrl} title={work.title} body={work.body} cta={work.cta || ""} />
          )}
          {kind === "audit" && (
            <PlanLook
              body={work.body}
              keyword={work.targetKeyword}
              url={work.targetUrl || href}
            />
          )}
        </div>

        <footer className="wp-foot">
          {onDecline && (
            <button type="button" className="wp-ghost" onClick={onDecline} disabled={busy}>Decline</button>
          )}
          {feedback && (
            <button type="button" className="wp-ghost" onClick={() => setFeedbackOpen((v) => !v)}>
              Give feedback
            </button>
          )}
          <span className="wp-spacer" />
          {onApprove && (
            <button type="button" className="wp-go" onClick={onApprove} disabled={busy}>
              {busy ? "Working…" : approveLabel}
            </button>
          )}
        </footer>
        {feedback && feedbackOpen && (
          <div className="wp-fb">
            <Field
              hideLabel
              label="Feedback for the agent"
              autoFocus
              value={feedback.value}
              disabled={feedback.sending}
              onChange={(e) => feedback.onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") feedback.onSend(); }}
              placeholder="Tell the agent what to change — shorter, different tone, add a photo…"
            />
            <button type="button" className="wp-go" onClick={feedback.onSend} disabled={feedback.sending}>
              {feedback.sending ? "Revising…" : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function kindLabel(kind: PreviewKind): string {
  if (kind === "google_post") return "Google post preview";
  if (kind === "meta") return "Search result preview";
  if (kind === "audit") return "What we will change";
  return "Page preview";
}

function PageLook({ brandName, siteUrl, title, body, targetUrl }: {
  brandName: string; siteUrl?: string | null; title: string; body: string; targetUrl?: string | null;
}) {
  const page = pageFromBody(body, title);
  const host = hostOf(siteUrl);
  const path = pathOf(targetUrl, page.title);
  const html = markdownToHtml(absolutizeMarkdownImages(page.markdown || body, siteUrl));
  return (
    <div className="wp-browser">
      <div className="wp-chrome">
        <span className="wp-dot" /><span className="wp-dot" /><span className="wp-dot" />
        <div className="wp-url">{host}{path}</div>
      </div>
      <div className="wp-page">
        <div className="wp-nav">{brandName}</div>
        <article className="wp-article">
          <h1>{displayWorkTitle(page.title)}</h1>
          {page.meta ? <p className="wp-lede">{page.meta}</p> : null}
          <div className="wp-html" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </div>
    </div>
  );
}

function SerpLook({ brandName, siteUrl, title, body, targetUrl }: {
  brandName: string; siteUrl?: string | null; title: string; body: string; targetUrl?: string | null;
}) {
  const meta = metaFromBody(body);
  const titles = meta?.titles.length ? meta.titles : [displayWorkTitle(title)];
  const metas = meta?.metas.length ? meta.metas : [];
  const host = hostOf(siteUrl);
  const path = pathOf(targetUrl, titles[0]);
  return (
    <div className="wp-serp">
      <div className="wp-serp-brand">Google</div>
      {titles.map((t, i) => (
        <div className="wp-result" key={`${t}-${i}`}>
          <div className="wp-result-url">{host}{path}</div>
          <div className="wp-result-title">{t}</div>
          <div className="wp-result-meta">{metas[i] || metas[0] || `${brandName} — ${t}`}</div>
        </div>
      ))}
    </div>
  );
}

function GbpLook({ brandName, siteUrl, title, body, cta }: {
  brandName: string; siteUrl?: string | null; title: string; body: string; cta: string;
}) {
  const image = firstMarkdownImage(body);
  const imgSrc = image ? resolvePreviewSrc(image.src, siteUrl) : null;
  const text = postTextWithoutImages(body);
  const headline = displayWorkTitle(title);
  const initial = (brandName.trim()[0] || "G").toUpperCase();
  return (
    <div className="wp-gbp-wrap">
      <div className="wp-gbp-app">
        <div className="wp-gbp-appbar" aria-hidden="true">
          <span className="wp-g"><b>G</b>oogle</span>
          <span>Business Profile</span>
        </div>
        <div className="wp-gbp">
          <div className="wp-gbp-head">
            <div className="wp-gbp-av" aria-hidden="true">{initial}</div>
            <div>
              <div className="wp-gbp-name">{brandName}</div>
              <div className="wp-gbp-when">Google · Just now</div>
            </div>
          </div>
          {imgSrc && <img className="wp-gbp-img" src={imgSrc} alt={image?.alt || ""} />}
          {headline ? <div className="wp-gbp-headline">{headline}</div> : null}
          {text ? <p className="wp-gbp-text">{text}</p> : null}
          {cta ? <div className="wp-gbp-cta">{cta}</div> : null}
        </div>
      </div>
    </div>
  );
}

function PlanLook({ body, keyword, url }: { body: string; keyword?: string | null; url?: string | null }) {
  const plan = rewritePlanFromBody(body, { keyword, url });
  return (
    <div className="wp-plan">
      <p className="wp-plan-intro">{plan.intro}</p>
      <ol className="wp-plan-list">
        {plan.steps.map((s) => (
          <li className="wp-step" key={s.n}>
            <span className="wp-step-n" aria-hidden="true">{s.n}</span>
            <div>
              <div className="wp-step-title">{s.title}</div>
              {s.detail ? <p className="wp-step-detail">{s.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function hostOf(siteUrl?: string | null): string {
  if (!siteUrl) return "your-site.com";
  try { return new URL(siteUrl).host; } catch { return siteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, ""); }
}

function pathOf(targetUrl?: string | null, title?: string): string {
  if (targetUrl) {
    try { return new URL(targetUrl).pathname; } catch { return targetUrl.startsWith("/") ? targetUrl : `/${targetUrl}`; }
  }
  const slug = (title || "page").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return `/${slug || "page"}`;
}

const WP_CSS = `
.wp-layer { position:fixed; inset:0; z-index:320; display:flex; align-items:stretch; justify-content:center; padding:18px; pointer-events:none; }
.wp-scrim { position:absolute; inset:0; background:rgba(16,24,40,.55); pointer-events:auto; }
.wp-sheet { position:relative; pointer-events:auto; background:#F4F6FA; color:#1A2030; width:min(920px,100%); max-height:100%; border-radius:16px; display:flex; flex-direction:column; box-shadow:0 24px 80px rgba(16,24,40,.28); overflow:hidden; }
.wp-top { display:flex; justify-content:space-between; gap:12px; padding:16px 18px; background:#fff; border-bottom:1px solid #E7EAF0; }
.wp-kicker { font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#6C5CE7; }
.wp-top-title { font-size:16px; font-weight:700; letter-spacing:-.02em; margin-top:2px; }
.wp-top-url { display:block; font-size:12.5px; color:#6C5CE7; margin-top:6px; word-break:break-all; }
.wp-x { width:36px; height:36px; border:1px solid #E7EAF0; background:#fff; border-radius:8px; cursor:pointer; color:#6B768D; flex-shrink:0; }
.wp-stage { flex:1; overflow:auto; padding:18px; }
.wp-foot { display:flex; gap:8px; align-items:center; padding:12px 18px; background:#fff; border-top:1px solid #E7EAF0; flex-wrap:wrap; }
.wp-spacer { flex:1; }
.wp-go { background:#6C5CE7; color:#fff; border:0; padding:9px 16px; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer; font-family:inherit; }
.wp-go:disabled { opacity:.55; cursor:default; }
.wp-ghost { background:transparent; color:#6B768D; border:1px solid #E7EAF0; padding:9px 16px; border-radius:8px; font-size:13px; cursor:pointer; font-family:inherit; }
.wp-fb { display:flex; gap:8px; padding:0 18px 14px; background:#fff; align-items:flex-end; }
.wp-fb .fld { flex:1; }
.wp-browser { background:#fff; border:1px solid #E7EAF0; border-radius:12px; overflow:hidden; }
.wp-chrome { display:flex; align-items:center; gap:6px; padding:10px 12px; background:#F0F2F5; border-bottom:1px solid #E7EAF0; }
.wp-dot { width:8px; height:8px; border-radius:50%; background:#D0D5DD; }
.wp-url { margin-left:8px; flex:1; background:#fff; border:1px solid #E7EAF0; border-radius:999px; padding:5px 12px; font-size:12px; color:#6B768D; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.wp-page { background:#fff; }
.wp-nav { padding:16px 28px; font-weight:700; letter-spacing:-.02em; border-bottom:1px solid #F0F2F5; }
.wp-article { padding:28px 32px 40px; max-width:720px; }
.wp-article h1 { font-size:28px; letter-spacing:-.03em; margin:0 0 10px; line-height:1.2; }
.wp-lede { color:#6B768D; font-size:15px; margin:0 0 22px; }
.wp-html { font-size:16px; line-height:1.7; color:#1A2030; }
.wp-html h2, .wp-html h3 { letter-spacing:-.02em; margin:28px 0 10px; }
.wp-html p { margin:0 0 14px; }
.wp-html img { max-width:100%; height:auto; border-radius:10px; margin:8px 0 16px; display:block; }
.wp-html ul, .wp-html ol { padding-left:22px; margin:0 0 14px; }
.wp-serp { background:#fff; border-radius:12px; padding:22px 26px; max-width:640px; margin:0 auto; }
.wp-serp-brand { font-size:22px; font-weight:700; color:#4285F4; letter-spacing:-.04em; margin-bottom:18px; }
.wp-result { margin-bottom:18px; }
.wp-result-url { font-size:13px; color:#188038; }
.wp-result-title { font-size:20px; color:#1A0DAB; line-height:1.3; margin:3px 0 4px; }
.wp-result-meta { font-size:14px; color:#4D5156; line-height:1.5; }
.wp-gbp-wrap { display:flex; justify-content:center; }
.wp-gbp-app { width:min(420px,100%); background:#F8F9FA; border:1px solid #DADCE0; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(16,24,40,.08); }
.wp-gbp-appbar { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#fff; border-bottom:1px solid #E8EAED; font-size:12px; color:#5F6368; }
.wp-g { font-weight:700; letter-spacing:-.03em; color:#5F6368; }
.wp-g b { color:#4285F4; font-weight:700; }
.wp-gbp { background:#fff; }
.wp-gbp-head { display:flex; gap:10px; align-items:center; padding:14px 14px 10px; }
.wp-gbp-av { width:40px; height:40px; border-radius:50%; background:#1A73E8; color:#fff; display:grid; place-items:center; font-weight:700; }
.wp-gbp-name { font-weight:700; font-size:14px; }
.wp-gbp-when { font-size:12px; color:#70757A; }
.wp-gbp-img { width:100%; max-height:240px; object-fit:cover; display:block; background:#F0F2F5; }
.wp-gbp-headline { padding:4px 14px 0; font-weight:700; font-size:15px; }
.wp-gbp-text { margin:0; padding:8px 14px 8px; font-size:14.5px; line-height:1.5; white-space:pre-wrap; }
.wp-gbp-cta { margin:8px 14px 16px; border:1px solid #DADCE0; color:#1A73E8; text-align:center; padding:8px; border-radius:8px; font-weight:600; font-size:13px; }
.wp-plan { background:#fff; border:1px solid #E7EAF0; border-radius:12px; padding:22px 26px; }
.wp-plan-intro { font-size:15px; line-height:1.6; margin:0 0 8px; color:#3A4256; }
.wp-plan-list { list-style:none; margin:0; padding:0; }
.wp-step { display:flex; gap:14px; padding:14px 0; border-top:1px solid #F0F2F5; }
.wp-step-n { width:28px; height:28px; border-radius:50%; background:#6C5CE7; color:#fff; display:grid; place-items:center; font-weight:700; font-size:13px; flex-shrink:0; }
.wp-step-title { font-weight:700; margin:0 0 4px; }
.wp-step-detail { margin:0; color:#6B768D; font-size:14px; line-height:1.55; }
.wp-why-block { padding:14px 18px 12px; background:#F7F6FF; border-bottom:1px solid #EDEAF8; }
.wp-why { margin:6px 0 0; font-size:13.5px; line-height:1.65; color:#3A4256; white-space:pre-wrap; max-width:68ch; }
@media (max-width:640px) {
  .wp-layer { padding:0; }
  .wp-sheet { border-radius:0; }
  .wp-article { padding:20px 18px 32px; }
}
`;
