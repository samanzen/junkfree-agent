"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Field from "@/app/_components/Field";
import type { AuditReport } from "@/lib/audit/report";
import { TRIAL_DAYS } from "@/lib/ui/tokens";

// THE FUNNEL ENTRY POINT.
//
// URL in → real audit → useful partial report → email/account to unlock.
// Everything shown before signup is measured (on-page HTML and, when
// configured, DataForSEO domain/keyword/backlink data). Locked rows never
// invent figures — they withhold real remainder counts or ask for signup.

type Phase = "idle" | "scanning" | "done" | "error";

const SCAN_STEPS = [
  "Fetching your page",
  "Reading titles, headings and meta",
  "Checking rankings and backlinks",
  "Scoring against SEO best practice",
];

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 0 }).format(n);
}

function ScoreRing({ score, tone }: { score: number; tone: "good" | "mixed" | "poor" }) {
  const [shown, setShown] = useState(0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(score);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      setShown(Math.round(score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <div className={`ad-ring is-${tone}`}>
      <svg viewBox="0 0 128 128" role="img" aria-label={`SEO score ${score} out of 100`}>
        <circle className="ad-ring-track" cx="64" cy="64" r={radius} />
        <circle
          className="ad-ring-value"
          cx="64"
          cy="64"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </svg>
      <div className="ad-ring-mid">
        <b>{shown}</b>
        <span>/ 100</span>
      </div>
    </div>
  );
}

export default function AuditWidget() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState("");
  const [gateEmail, setGateEmail] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const run = useCallback(async () => {
    const value = url.trim();
    if (!value) {
      setError("Enter your website address to start.");
      setPhase("error");
      return;
    }

    setPhase("scanning");
    setError("");
    setReport(null);
    setStep(0);

    timers.current.forEach(clearTimeout);
    timers.current = SCAN_STEPS.map((_, i) =>
      setTimeout(() => setStep(i), i * 700),
    );

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const body = await res.json().catch(() => ({}));
      timers.current.forEach(clearTimeout);

      if (!res.ok) {
        setError(body.error || "We couldn't check that site. Try another address.");
        setPhase("error");
        return;
      }
      setReport(body.report as AuditReport);
      setPhase("done");
    } catch {
      timers.current.forEach(clearTimeout);
      setError("Connection problem. Check your network and try again.");
      setPhase("error");
    }
  }, [url]);

  useEffect(() => {
    if (phase === "done" && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  function signupHref(email?: string) {
    if (!report) return "/signup";
    const q = new URLSearchParams({ site: report.finalUrl });
    if (email?.trim()) q.set("email", email.trim());
    return `/signup?${q.toString()}`;
  }

  function continueWithEmail(e: FormEvent) {
    e.preventDefault();
    router.push(signupHref(gateEmail));
  }

  const showCue = !url.trim() && (phase === "idle" || phase === "error");
  const domain = report?.domain;
  const hasDomainMetrics =
    !!domain &&
    (domain.organicTraffic != null ||
      domain.organicKeywords != null ||
      domain.backlinks != null ||
      domain.referringDomains != null);
  const hasKeywordPreview = !!domain && domain.keywordsPreview.length > 0;

  return (
    <div className={`ad${showCue ? " is-cue" : ""}${phase === "done" ? " is-report" : ""}`}>
      <form
        className="ad-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <p className="ad-prompt" id="ad-prompt">
          See it on your site — free report in seconds
        </p>
        <div className="ad-stage">
          {showCue && (
            <div className="ad-cue" aria-hidden="true">
              <span className="ad-cue-label">Your domain</span>
              <svg className="ad-cue-arrow" viewBox="0 0 24 40" width="22" height="36">
                <path
                  d="M12 2v28M5 22l7 10 7-10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
          <div className="ad-input-row">
            <Field
              label="Website URL"
              hideLabel
              className="ad-field"
              inputClassName="ad-input"
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="yourwebsite.com"
              aria-describedby="ad-prompt"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (phase === "error") {
                  setPhase("idle");
                  setError("");
                }
              }}
              disabled={phase === "scanning"}
              error={phase === "error" ? error : null}
            />
            <button
              type="submit"
              className="ad-submit"
              disabled={phase === "scanning"}
              data-busy={phase === "scanning" || undefined}
            >
              <span>{phase === "scanning" ? "Analyzing…" : "Get my free report"}</span>
            </button>
          </div>
        </div>
        <p className="ad-micro">Free · No credit card · Results in seconds</p>
      </form>

      {phase === "scanning" && (
        <div className="ad-scan" role="status" aria-live="polite">
          <ol className="ad-scan-steps">
            {SCAN_STEPS.map((label, i) => (
              <li
                key={label}
                className={i < step ? "is-done" : i === step ? "is-active" : ""}
              >
                <span className="ad-scan-dot" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ol>
        </div>
      )}

      {phase === "done" && report && (
        <div className="ad-result" ref={resultRef} tabIndex={-1}>
          <div className="ad-result-head">
            <ScoreRing score={report.score} tone={report.band.tone} />
            <div className="ad-result-copy">
              <p className="ad-result-site">
                {report.finalUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </p>
              <h3 className={`ad-result-verdict is-${report.band.tone}`}>{report.band.label}</h3>
              <p className="ad-result-line">
                {report.issuesFound === 0
                  ? "We found no on-page problems on this page — a genuinely strong result."
                  : `We found ${report.issuesFound} on-page ${report.issuesFound === 1 ? "issue" : "issues"} costing you search visibility.`}
              </p>
              <div className="ad-result-counts">
                <span className="is-bad">{report.counts.fail} critical</span>
                <span className="is-warn">{report.counts.warn} warnings</span>
                <span className="is-good">{report.counts.pass} passed</span>
              </div>
            </div>
          </div>

          {/* Domain / off-page snapshot */}
          <section className="ad-section" aria-labelledby="ad-domain-title">
            <div className="ad-section-head">
              <h4 id="ad-domain-title" className="ad-sub">
                Domain snapshot
              </h4>
              <p className="ad-section-note">
                {hasDomainMetrics
                  ? `Organic visibility estimates · ${domain!.locationLabel}`
                  : "Sign in to load live domain, keyword and backlink metrics for this site."}
              </p>
            </div>
            <div className="ad-metric-grid">
              <div className="ad-metric">
                <span className="ad-metric-label">Est. organic traffic</span>
                <b className={hasDomainMetrics ? undefined : "is-locked"}>{fmt(domain?.organicTraffic)}</b>
              </div>
              <div className="ad-metric">
                <span className="ad-metric-label">Organic keywords</span>
                <b className={hasDomainMetrics ? undefined : "is-locked"}>{fmt(domain?.organicKeywords)}</b>
              </div>
              <div className="ad-metric">
                <span className="ad-metric-label">Backlinks</span>
                <b className={hasDomainMetrics ? undefined : "is-locked"}>{fmt(domain?.backlinks)}</b>
              </div>
              <div className="ad-metric">
                <span className="ad-metric-label">Referring domains</span>
                <b className={hasDomainMetrics ? undefined : "is-locked"}>{fmt(domain?.referringDomains)}</b>
              </div>
            </div>
          </section>

          {/* Keywords */}
          <section className="ad-section" aria-labelledby="ad-kw-title">
            <div className="ad-section-head">
              <h4 id="ad-kw-title" className="ad-sub">
                Keyword rankings
              </h4>
              <p className="ad-section-note">
                {hasKeywordPreview
                  ? `Where you rank now · volume & difficulty · ${domain!.locationLabel}`
                  : "Positions, search volume and keyword difficulty unlock with your free account."}
              </p>
            </div>

            {hasKeywordPreview ? (
              <>
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th scope="col">Keyword</th>
                        <th scope="col">Position</th>
                        <th scope="col">Volume</th>
                        <th scope="col">Difficulty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domain!.keywordsPreview.map((row) => (
                        <tr key={row.keyword}>
                          <td>{row.keyword}</td>
                          <td>
                            <span className={`ad-pos ${row.position <= 10 ? "is-good" : row.position <= 20 ? "is-warn" : ""}`}>
                              #{row.position}
                            </span>
                          </td>
                          <td>{fmt(row.volume)}</td>
                          <td>{row.difficulty == null ? "—" : row.difficulty}</td>
                        </tr>
                      ))}
                      {domain!.keywordsLockedCount > 0 &&
                        Array.from({ length: Math.min(3, domain!.keywordsLockedCount) }).map((_, i) => (
                          <tr key={`locked-kw-${i}`} className="is-locked-row">
                            <td colSpan={4}>
                              <div className="ad-locked-row-inner">
                                <span className="ad-lock" aria-hidden="true">
                                  <LockIcon />
                                </span>
                                <span className="ad-locked-blur" aria-hidden="true" />
                                <span className="ad-sr">Locked keyword row</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {domain!.keywordsLockedCount > 0 && (
                  <p className="ad-locked-note">
                    <LockIcon /> {domain!.keywordsLockedCount} more ranking{" "}
                    {domain!.keywordsLockedCount === 1 ? "keyword" : "keywords"} locked — unlock with email below.
                  </p>
                )}
              </>
            ) : (
              <div className="ad-locked-panel">
                <ul className="ad-locked-list">
                  {["Top ranking keywords + positions", "Search volume by keyword", "Keyword difficulty scores"].map(
                    (label) => (
                      <li key={label}>
                        <span className="ad-lock" aria-hidden="true">
                          <LockIcon />
                        </span>
                        <span className="ad-locked-label">{label}</span>
                        <span className="ad-locked-blur" aria-hidden="true" />
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </section>

          {/* On-page issues */}
          {report.previewIssues.length > 0 && (
            <section className="ad-section ad-issues" aria-labelledby="ad-issues-title">
              <h4 id="ad-issues-title" className="ad-sub">
                What&apos;s hurting you most
              </h4>
              <div className="ad-issue-grid">
                {report.previewIssues.map((issue) => (
                  <div key={issue.id} className={`ad-issue is-${issue.status}`}>
                    <div className="ad-issue-top">
                      <span className={`ad-chip is-${issue.status}`}>
                        {issue.status === "fail" ? "Critical" : "Warning"}
                      </span>
                      <strong>{issue.label}</strong>
                    </div>
                    <p className="ad-issue-detail">{issue.detail}</p>
                    <p className="ad-issue-fix">
                      <span>Fix</span>
                      {issue.fix}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {report.passedChecks.length > 0 && (
            <section className="ad-section" aria-labelledby="ad-pass-title">
              <h4 id="ad-pass-title" className="ad-sub">
                Already looking good
              </h4>
              <ul className="ad-pass-grid">
                {report.passedChecks.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <span aria-hidden="true">✓</span>
                    {c.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Gate */}
          <div className="ad-gate">
            {report.lockedIssueCount > 0 && (
              <div className="ad-locked-issues">
                <h4 className="ad-sub">
                  {report.lockedIssueCount} more{" "}
                  {report.lockedIssueCount === 1 ? "issue" : "issues"} found on this page
                </h4>
                <ul className="ad-locked-list">
                  {report.lockedIssueLabels.map((label) => (
                    <li key={label}>
                      <span className="ad-lock" aria-hidden="true">
                        <LockIcon />
                      </span>
                      <span className="ad-locked-label">{label}</span>
                      <span className="ad-locked-blur" aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ad-modules">
              <h4 className="ad-sub">Unlock the full picture</h4>
              <div className="ad-module-grid">
                {report.lockedModules.map((m) => (
                  <div key={m.id} className="ad-module">
                    <span className="ad-lock" aria-hidden="true">
                      <LockIcon />
                    </span>
                    <strong>{m.label}</strong>
                    <p>{m.promise}</p>
                    <small>{m.requires}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="ad-cta">
              <h4>Email yourself the full report</h4>
              <p>
                Enter your email to create a free account, unlock every keyword and issue, and let
                AI draft the fixes for your approval.
              </p>
              <form className="ad-cta-form" onSubmit={continueWithEmail}>
                <Field
                  label="Work email"
                  hideLabel
                  className="ad-cta-field"
                  inputClassName="ad-cta-input"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  value={gateEmail}
                  onChange={(e) => setGateEmail(e.target.value)}
                />
                <button type="submit" className="ad-cta-btn">
                  Unlock my full report — free
                </button>
              </form>
              <p className="ad-cta-micro">
                {TRIAL_DAYS}-day free trial · No credit card · Or{" "}
                <Link href={signupHref()}>continue without email</Link>
              </p>
            </div>
          </div>

          <button
            type="button"
            className="ad-again"
            onClick={() => {
              setPhase("idle");
              setReport(null);
              setUrl("");
              setGateEmail("");
            }}
          >
            Check another website
          </button>
        </div>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
