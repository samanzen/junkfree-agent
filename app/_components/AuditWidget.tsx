"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Field from "@/app/_components/Field";
import type { AuditReport } from "@/lib/audit/report";

// THE FUNNEL ENTRY POINT.
//
// URL in → real audit → partial report → account to unlock. Modelled on how
// Semrush and Ahrefs convert, with one deliberate difference: everything shown
// before signup is genuinely measured on the visitor's own page, and everything
// held back is either a real measured issue we are withholding (exact count) or
// a capability that truly needs their data. Nothing behind the lock is invented,
// because a report that overstates is worth less than one that converts slightly
// slower.

type Phase = "idle" | "scanning" | "done" | "error";

const SCAN_STEPS = [
  "Fetching your page",
  "Reading titles, headings and meta",
  "Checking mobile and indexing",
  "Scoring against SEO best practice",
];

function ScoreRing({ score, tone }: { score: number; tone: "good" | "mixed" | "poor" }) {
  const [shown, setShown] = useState(0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  // Count up so the number reads as a result being produced, not a static fact.
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
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState("");
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

    // The steps are honest labels for work that is genuinely happening server
    // side; they advance on a timer only because a single fetch gives us no
    // progress events to subscribe to.
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

  // Move focus/scroll to the result so the payoff is not below the fold.
  useEffect(() => {
    if (phase === "done" && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  const signupHref = report
    ? `/signup?site=${encodeURIComponent(report.finalUrl)}`
    : "/signup";

  return (
    <div className="ad">
      <form
        className="ad-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="ad-input-row">
          <Field
            label="Enter your website to get a free SEO report"
            className="ad-field"
            inputClassName="ad-input"
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="yourwebsite.com"
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

          {report.previewIssues.length > 0 && (
            <div className="ad-issues">
              <h4 className="ad-sub">What&apos;s hurting you most</h4>
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
          )}

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
              <h4>Get the full report and let AI fix it</h4>
              <p>
                Create your free account to see every issue, connect Search Console for your real
                rankings, and have the fixes written for your approval.
              </p>
              <Link href={signupHref} className="ad-cta-btn">
                Unlock my full report — free
              </Link>
              <p className="ad-cta-micro">
                14-day free trial · No credit card required · Cancel anytime
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
