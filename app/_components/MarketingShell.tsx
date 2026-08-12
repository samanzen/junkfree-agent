"use client";
import Link from "next/link";
import { PLATFORM_NAME, touchTargetCSS, down, up } from "@/lib/ui/tokens";

// Marketing chrome for the public site (landing, pricing, signup). Kept out of
// the portal/dashboard stylesheets so product UI and marketing can evolve
// independently — marketing may use distinctive display faces; the apps do not.

/** Inbox for Managed / sales inquiries until self-serve billing is live. */
export const TALK_TO_US_HREF =
  "mailto:hello@example.com?subject=" +
  encodeURIComponent(`${PLATFORM_NAME} — talk to us`);

export function MarketingNav({ active }: { active?: "pricing" | "product" | "login" | "signup" }) {
  return (
    <header className="mk-nav">
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="mk-nav-inner">
        <Link href="/" className="mk-mark" aria-current={active ? undefined : "page"}>
          <span className="mk-mark-dot" aria-hidden="true" />
          <span className="mk-mark-name">{PLATFORM_NAME}</span>
        </Link>
        <nav className="mk-nav-links" aria-label="Primary">
          <a href="/#how" className={active === "product" ? "is-active" : undefined}>Product</a>
          <Link href="/pricing" className={active === "pricing" ? "is-active" : undefined}>Pricing</Link>
          <Link href="/login" className={active === "login" ? "is-active" : undefined}>Login</Link>
          <Link href="/signup" className={`mk-btn mk-btn-primary mk-btn-nav${active === "signup" ? " is-active" : ""}`}>
            Start trial
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-wrap mk-footer-inner">
        <div className="mk-footer-brand">
          <span className="mk-mark-dot" aria-hidden="true" />
          {PLATFORM_NAME}
        </div>
        <p className="mk-footer-note">
          Approvals stay with you. Publishing and Search Console connect when you are ready.
        </p>
        <div className="mk-footer-links">
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup">Start trial</Link>
          <a href={TALK_TO_US_HREF}>Talk to us</a>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "pricing" | "product" | "login" | "signup";
}) {
  return (
    <div className="mk">
      <style>{MARKETING_CSS}</style>
      <MarketingNav active={active} />
      {children}
      <MarketingFooter />
    </div>
  );
}

export const MARKETING_CSS = `
/* Marketing surface — Signal blue brand, Syne + DM Sans, no glass/glow clutter.
   Scoped under .mk so portal/dashboard tokens are never overridden. */
.mk {
  --mk-bg: #F3F5F9;
  --mk-bg-deep: #E8EDF5;
  --mk-ink: #0F172A;
  --mk-ink-soft: #334155;
  --mk-muted: #5B6578;
  --mk-line: #D5DCE8;
  --mk-line-strong: #B8C2D4;
  --mk-surface: #FFFFFF;
  --mk-accent: #2563EB;
  --mk-accent-hover: #1D4FD8;
  --mk-accent-active: #1A45BE;
  --mk-system: #6D3BE4;
  --mk-danger: #B3261E;
  --mk-font-display: var(--font-syne, 'Syne'), var(--font-dm-sans, 'DM Sans'), var(--font-sans);
  --mk-font-body: var(--font-dm-sans, 'DM Sans'), var(--font-sans);
  min-height: 100vh;
  background: var(--mk-bg);
  color: var(--mk-ink);
  font-family: var(--mk-font-body);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.mk a { color: inherit; }
.mk .mk-wrap {
  width: min(1120px, calc(100% - 40px));
  margin-inline: auto;
}

/* ── Sticky nav ── */
.mk-nav {
  position: sticky; top: 0; z-index: 40;
  backdrop-filter: none;
  background: color-mix(in srgb, var(--mk-bg) 92%, transparent);
  border-bottom: 1px solid transparent;
  transition: border-color var(--dur-2) var(--ease-out), background var(--dur-2) var(--ease-out);
}
.mk-nav:focus-within,
.mk-nav:hover { border-bottom-color: var(--mk-line); }
.mk-nav-inner {
  width: min(1120px, calc(100% - 40px));
  margin-inline: auto;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; min-height: 64px; padding: 10px 0;
}
.mk-mark {
  display: inline-flex; align-items: center; gap: 10px;
  text-decoration: none; min-height: 44px;
}
.mk-mark-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--mk-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--mk-accent) 16%, transparent);
  flex: none;
}
.mk-mark-name {
  font-family: var(--mk-font-display);
  font-weight: 700; font-size: 1.05rem; letter-spacing: -.02em;
}
.mk-nav-links {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end;
}
.mk-nav-links > a:not(.mk-btn) {
  text-decoration: none; color: var(--mk-ink-soft);
  font-size: 14px; font-weight: 550; padding: 10px 12px; border-radius: var(--radius-sm);
  transition: color var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out);
}
.mk-nav-links > a:not(.mk-btn):hover,
.mk-nav-links > a:not(.mk-btn).is-active { color: var(--mk-ink); background: color-mix(in srgb, var(--mk-accent) 8%, transparent); }

/* ── Buttons ── */
.mk-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  text-decoration: none; border: 1px solid transparent;
  border-radius: var(--radius-sm); font-weight: 600; font-size: 14.5px;
  padding: 12px 18px; cursor: pointer; font-family: inherit;
  transition: background var(--dur-2) var(--ease-out), border-color var(--dur-2) var(--ease-out),
    color var(--dur-2) var(--ease-out), transform var(--dur-1);
}
.mk-btn:active:not(:disabled) { transform: translateY(1px); }
.mk-btn-primary { background: var(--mk-accent); color: #fff; }
.mk-btn-primary:hover:not(:disabled) { background: var(--mk-accent-hover); }
.mk-btn-primary:active:not(:disabled) { background: var(--mk-accent-active); }
.mk-btn-secondary {
  background: transparent; color: var(--mk-ink);
  border-color: var(--mk-line-strong);
}
.mk-btn-secondary:hover:not(:disabled) { border-color: var(--mk-ink-soft); background: rgba(255,255,255,.55); }
.mk-btn-nav { padding: 10px 14px; font-size: 13.5px; }
.mk-btn:disabled { opacity: .6; cursor: default; }

/* ── Sections ── */
.mk-section { padding: clamp(64px, 10vw, 104px) 0; }
.mk-section-tight { padding: clamp(48px, 8vw, 72px) 0; }
.mk-eyebrow {
  font-size: 12px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase;
  color: var(--mk-muted); margin: 0 0 12px;
}
.mk-h2 {
  font-family: var(--mk-font-display);
  font-size: clamp(28px, 4vw, 40px); line-height: 1.12; letter-spacing: -.03em;
  font-weight: 740; margin: 0 0 14px; max-width: 18ch;
}
.mk-lead {
  margin: 0; max-width: 52ch; color: var(--mk-ink-soft); font-size: 17px; line-height: 1.55;
}
.mk-section-head { margin-bottom: clamp(28px, 5vw, 40px); }

/* ── Hero ── */
.mk-hero {
  position: relative; overflow: hidden;
  min-height: min(92vh, 880px);
  display: flex; align-items: flex-end;
  padding: clamp(72px, 12vh, 120px) 0 clamp(48px, 8vh, 80px);
  /* Atmospheric plane — brand blue depth + cool slate, not purple SaaS wash */
  background:
    radial-gradient(1200px 640px at 78% 18%, rgba(37,99,235,.18), transparent 58%),
    radial-gradient(900px 520px at 12% 88%, rgba(15,23,42,.08), transparent 55%),
    linear-gradient(165deg, #EEF2F8 0%, #F7F8FB 42%, #E7EDF7 100%);
}
.mk-hero::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(15,23,42,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15,23,42,.035) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 70% at 60% 40%, #000 20%, transparent 75%);
  animation: mkGridDrift 28s linear infinite;
}
.mk-hero-inner {
  position: relative; z-index: 1;
  width: min(1120px, calc(100% - 40px));
  margin-inline: auto;
  display: grid; gap: clamp(36px, 6vw, 56px);
}
${up.md} {
  .mk-hero-inner { grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); align-items: end; }
}
.mk-hero-copy { max-width: 34rem; }
.mk-hero-brand {
  font-family: var(--mk-font-display);
  font-size: clamp(42px, 7.2vw, 72px);
  line-height: .98; letter-spacing: -.04em; font-weight: 780;
  margin: 0 0 18px;
  animation: mkRise .7s var(--ease-out) both;
}
.mk-hero-headline {
  font-family: var(--mk-font-display);
  font-size: clamp(22px, 3.2vw, 30px);
  line-height: 1.2; letter-spacing: -.025em; font-weight: 650;
  margin: 0 0 14px; color: var(--mk-ink);
  max-width: 22ch;
  animation: mkRise .7s var(--ease-out) .08s both;
}
.mk-hero-support {
  margin: 0 0 28px; color: var(--mk-ink-soft); font-size: 17px; max-width: 38ch;
  animation: mkRise .7s var(--ease-out) .14s both;
}
.mk-hero-cta {
  display: flex; flex-wrap: wrap; gap: 12px;
  animation: mkRise .7s var(--ease-out) .2s both;
}

/* CSS product visualization — composed panels, not stock photography */
.mk-viz {
  position: relative; min-height: 280px;
  animation: mkRise .8s var(--ease-out) .18s both;
}
.mk-viz-plane {
  position: absolute; inset: 8% 4% 0 8%;
  border: 1px solid var(--mk-line);
  background:
    linear-gradient(180deg, rgba(255,255,255,.92), rgba(243,246,251,.96)),
    repeating-linear-gradient(-12deg, transparent, transparent 14px, rgba(37,99,235,.04) 14px, rgba(37,99,235,.04) 15px);
  border-radius: 4px 22px 8px 18px;
  box-shadow: var(--shadow-3);
  overflow: hidden;
}
.mk-viz-rail {
  position: absolute; left: 0; top: 0; bottom: 0; width: 28%;
  border-right: 1px solid var(--mk-line);
  background: linear-gradient(180deg, #F8FAFD, #EEF3FA);
  padding: 18px 14px; display: flex; flex-direction: column; gap: 10px;
}
.mk-viz-rail span {
  display: block; height: 8px; border-radius: 4px;
  background: color-mix(in srgb, var(--mk-ink) 10%, transparent);
}
.mk-viz-rail span:nth-child(1) { width: 72%; background: color-mix(in srgb, var(--mk-accent) 55%, #cbd5e1); }
.mk-viz-rail span:nth-child(2) { width: 58%; }
.mk-viz-rail span:nth-child(3) { width: 64%; }
.mk-viz-rail span:nth-child(4) { width: 48%; }
.mk-viz-main { position: absolute; left: 28%; right: 0; top: 0; bottom: 0; padding: 20px 22px; }
.mk-viz-bar {
  height: 10px; width: 42%; border-radius: 5px; margin-bottom: 18px;
  background: color-mix(in srgb, var(--mk-ink) 14%, transparent);
}
.mk-viz-rows { display: grid; gap: 10px; }
.mk-viz-row {
  display: grid; grid-template-columns: 1.2fr .6fr .5fr; gap: 10px; align-items: center;
}
.mk-viz-row i {
  display: block; height: 9px; border-radius: 4px;
  background: color-mix(in srgb, var(--mk-ink) 9%, transparent);
  font-style: normal;
}
.mk-viz-row i:last-child {
  height: 22px; border-radius: 6px;
  background: color-mix(in srgb, var(--mk-accent) 18%, #e2e8f0);
}
.mk-viz-pulse {
  position: absolute; right: 10%; top: 14%;
  width: 120px; height: 120px; border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--mk-system) 35%, transparent);
  background: radial-gradient(circle at 40% 40%, color-mix(in srgb, var(--mk-system) 14%, transparent), transparent 68%);
  animation: mkPulse 4.8s var(--ease-inout) infinite;
  pointer-events: none;
}
.mk-viz-tag {
  position: absolute; left: 0; bottom: 6%;
  font-family: var(--mk-font-display); font-size: 12px; font-weight: 700;
  letter-spacing: .06em; text-transform: uppercase; color: var(--mk-muted);
}

/* ── How it works ── */
.mk-steps {
  list-style: none; margin: 0; padding: 0;
  display: grid; gap: 0;
  counter-reset: mkstep;
}
${up.sm} {
  .mk-steps { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; }
}
.mk-step {
  position: relative; padding: 20px 18px 20px 0;
  border-top: 1px solid var(--mk-line);
  counter-increment: mkstep;
}
${up.sm} {
  .mk-step { border-top: 0; border-left: 1px solid var(--mk-line); padding: 0 16px 0 20px; }
  .mk-step:first-child { border-left: 0; padding-left: 0; }
}
.mk-step::before {
  content: counter(mkstep, decimal-leading-zero);
  display: block; font-family: var(--mk-font-display);
  font-size: 13px; font-weight: 700; letter-spacing: .06em;
  color: var(--mk-accent); margin-bottom: 10px;
}
.mk-step h3 {
  font-family: var(--mk-font-display); font-size: 18px; margin: 0 0 8px;
  letter-spacing: -.02em; font-weight: 700;
}
.mk-step p { margin: 0; color: var(--mk-ink-soft); font-size: 14.5px; }

/* ── Work performed ── */
.mk-work {
  list-style: none; margin: 0; padding: 0;
  display: grid; gap: 22px;
}
${up.sm} { .mk-work { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 36px; } }
.mk-work li { padding-top: 16px; border-top: 1px solid var(--mk-line); }
.mk-work h3 {
  font-family: var(--mk-font-display); font-size: 19px; margin: 0 0 8px;
  letter-spacing: -.02em; font-weight: 700;
}
.mk-work p { margin: 0; color: var(--mk-ink-soft); font-size: 15px; max-width: 40ch; }

/* ── Trust ── */
.mk-trust {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--mk-bg-deep) 70%, transparent), var(--mk-bg));
  border-block: 1px solid var(--mk-line);
}
.mk-trust-grid {
  display: grid; gap: 28px;
}
${up.sm} { .mk-trust-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; } }
.mk-trust-grid h3 {
  font-family: var(--mk-font-display); font-size: 18px; margin: 0 0 8px;
  letter-spacing: -.02em; font-weight: 700;
}
.mk-trust-grid p { margin: 0; color: var(--mk-ink-soft); font-size: 15px; }

/* ── Integrations ── */
.mk-integ {
  list-style: none; margin: 0; padding: 0;
  display: grid; gap: 0; border-top: 1px solid var(--mk-line);
}
.mk-integ li {
  display: grid; gap: 6px; padding: 22px 0;
  border-bottom: 1px solid var(--mk-line);
}
${up.sm} {
  .mk-integ li {
    grid-template-columns: 200px 120px 1fr;
    align-items: baseline; gap: 20px;
  }
}
.mk-integ strong {
  font-family: var(--mk-font-display); font-size: 17px; font-weight: 700; letter-spacing: -.015em;
}
.mk-status {
  font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: var(--mk-accent);
}
.mk-status.is-partial { color: var(--mk-system); }
.mk-status.is-soon { color: var(--mk-muted); }
.mk-integ p { margin: 0; color: var(--mk-ink-soft); font-size: 14.5px; }

/* ── Final CTA ── */
.mk-final {
  text-align: center;
  background:
    radial-gradient(700px 280px at 50% 0%, rgba(37,99,235,.12), transparent 70%),
    var(--mk-bg);
}
.mk-final .mk-h2 { max-width: none; margin-inline: auto; }
.mk-final .mk-lead { margin-inline: auto; margin-bottom: 28px; }
.mk-final-cta { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; }

/* ── Pricing ── */
.mk-price-grid {
  display: grid; gap: 20px;
}
${up.md} { .mk-price-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; } }
.mk-price {
  background: var(--mk-surface);
  border: 1px solid var(--mk-line);
  border-radius: var(--radius-md);
  padding: 28px 24px;
  display: flex; flex-direction: column; gap: 14px;
  /* Cards only where choice/interaction lives — pricing tiers */
}
.mk-price.is-featured {
  border-color: color-mix(in srgb, var(--mk-accent) 45%, var(--mk-line));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--mk-accent) 20%, transparent);
}
.mk-price h2 {
  font-family: var(--mk-font-display); font-size: 22px; margin: 0;
  letter-spacing: -.02em; font-weight: 740;
}
.mk-price .mk-price-amt {
  font-family: var(--mk-font-display); font-size: 34px; font-weight: 760;
  letter-spacing: -.03em; margin: 0; line-height: 1;
}
.mk-price .mk-price-amt span { font-size: 14px; font-weight: 600; color: var(--mk-muted); letter-spacing: 0; }
.mk-price p { margin: 0; color: var(--mk-ink-soft); font-size: 14.5px; flex: 1; }
.mk-price ul {
  margin: 0; padding: 0; list-style: none;
  display: grid; gap: 8px; font-size: 14px; color: var(--mk-ink-soft);
}
.mk-price ul li::before {
  content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: var(--mk-accent); margin-right: 10px; vertical-align: middle;
}
.mk-price-note {
  margin: 28px 0 0; color: var(--mk-muted); font-size: 13.5px; max-width: 62ch;
}

/* ── Auth forms on marketing ground ── */
.mk-auth {
  min-height: calc(100vh - 140px);
  display: flex; align-items: center; justify-content: center;
  padding: 40px 20px 72px;
}
.mk-auth-card {
  width: 100%; max-width: 420px;
  background: var(--mk-surface);
  border: 1px solid var(--mk-line);
  border-radius: var(--radius-lg);
  padding: 36px; box-shadow: var(--shadow-3);
}
.mk-auth-card h1 {
  font-family: var(--mk-font-display);
  font-size: 28px; letter-spacing: -.03em; margin: 0 0 6px; font-weight: 740;
}
.mk-auth-card .mk-auth-sub { margin: 0 0 24px; color: var(--mk-muted); font-size: 14px; }
.mk-auth-fields { display: flex; flex-direction: column; gap: 16px; margin-bottom: 16px; }
.mk-auth-err {
  color: var(--mk-danger); font-size: 13px; margin-bottom: 10px;
  padding: 10px 12px; background: rgba(179,38,30,.08);
  border-radius: var(--radius-sm); border: 1px solid rgba(179,38,30,.2);
}
.mk-auth-ok {
  color: #0B7A42; font-size: 13px; margin-bottom: 10px;
  padding: 10px 12px; background: rgba(11,122,66,.08);
  border-radius: var(--radius-sm); border: 1px solid rgba(11,122,66,.2);
}
.mk-auth-foot { margin: 18px 0 0; font-size: 14px; color: var(--mk-muted); text-align: center; }
.mk-auth-foot a { color: var(--mk-accent); font-weight: 600; text-decoration: none; }
.mk-auth-foot a:hover { text-decoration: underline; }

/* ── Footer ── */
.mk-footer {
  border-top: 1px solid var(--mk-line);
  padding: 36px 0 48px;
  background: color-mix(in srgb, var(--mk-bg-deep) 55%, var(--mk-bg));
}
.mk-footer-inner { display: grid; gap: 12px; }
.mk-footer-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--mk-font-display); font-weight: 700; letter-spacing: -.02em;
}
.mk-footer-note { margin: 0; color: var(--mk-muted); font-size: 13.5px; max-width: 48ch; }
.mk-footer-links { display: flex; flex-wrap: wrap; gap: 8px 18px; }
.mk-footer-links a {
  color: var(--mk-ink-soft); text-decoration: none; font-size: 13.5px; font-weight: 550;
  min-height: 44px; display: inline-flex; align-items: center;
}
.mk-footer-links a:hover { color: var(--mk-ink); }

@keyframes mkRise {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}
@keyframes mkGridDrift {
  from { background-position: 0 0, 0 0; }
  to { background-position: 48px 48px, 48px 48px; }
}
@keyframes mkPulse {
  0%, 100% { transform: scale(1); opacity: .85; }
  50% { transform: scale(1.06); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .mk-hero::before, .mk-viz-pulse,
  .mk-hero-brand, .mk-hero-headline, .mk-hero-support, .mk-hero-cta, .mk-viz {
    animation: none !important;
  }
}

${down.sm} {
  .mk-nav-inner { width: calc(100% - 28px); }
  .mk-wrap { width: calc(100% - 28px); }
  .mk-nav-links > a:not(.mk-btn) { padding: 10px 8px; }
  .mk-hero { align-items: center; min-height: auto; padding-top: 48px; }
  .mk-auth-card { padding: 28px 22px; border-radius: var(--radius-md); }
}

/* Shared field + touch guarantees for marketing auth forms */
.mk .fld { display:flex; flex-direction:column; gap:6px; min-width:0; }
.mk .fld-label {
  font-size:12.5px; font-weight:600; letter-spacing:-.005em; color:var(--mk-ink);
  display:inline-flex; align-items:center; gap:4px;
}
.mk .fld-req { color:var(--mk-danger); font-weight:600; }
.mk .fld-sr {
  position:absolute; width:1px; height:1px; margin:-1px; padding:0;
  overflow:hidden; clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap;
}
.mk .fld-control { position:relative; display:flex; }
.mk .fld-input {
  width:100%; background:#F6F8FB; color:var(--mk-ink);
  border:1px solid var(--mk-line); border-radius:var(--radius-sm);
  padding:10px 12px; font-family:inherit;
  transition:border-color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out);
}
.mk .fld-input::placeholder { color:var(--mk-muted); opacity:.8; }
.mk .fld-input:hover:not(:disabled) { border-color:var(--mk-line-strong); }
.mk .fld-input:focus {
  outline:none; border-color:var(--mk-accent);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--mk-accent) 18%, transparent);
}
.mk .fld-input:disabled { opacity:.55; cursor:not-allowed; }
.mk .fld-select { appearance:none; padding-right:34px; cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,var(--mk-muted) 50%),linear-gradient(135deg,var(--mk-muted) 50%,transparent 50%);
  background-position:calc(100% - 17px) calc(50% + 1px), calc(100% - 12px) calc(50% + 1px);
  background-size:5px 5px, 5px 5px; background-repeat:no-repeat;
}
.mk .fld.is-error .fld-input { border-color:var(--mk-danger); }
.mk .fld-helper { font-size:11.5px; line-height:1.5; color:var(--mk-muted); margin:0; }
.mk .fld-error { font-size:11.5px; line-height:1.5; color:var(--mk-danger); margin:0; }
.mk [data-busy="true"] { position:relative; pointer-events:none; }
.mk [data-busy="true"] > * { visibility:hidden; }
.mk [data-busy="true"]::after {
  content:""; position:absolute; inset:0; margin:auto;
  width:15px; height:15px; border:2px solid currentColor; border-top-color:transparent;
  border-radius:50%; opacity:.75; animation:ldSpin .7s linear infinite;
}
@keyframes ldSpin { to { transform:rotate(360deg); } }

${touchTargetCSS(".mk")}
`;
