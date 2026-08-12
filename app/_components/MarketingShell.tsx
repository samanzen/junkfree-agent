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
/* Marketing surface — cyan/navy/orange, Inter throughout, no glass/glow clutter.
   Scoped under .mk so portal/dashboard tokens are never overridden: the product
   keeps the Signal system (blue = action, violet = machine) untouched, while
   marketing runs a warmer, higher-contrast palette built for conversion.

   Every pairing below was measured rather than eyeballed:
     ink #1B2C3F on bg          13.2:1
     ink-soft #42566B on bg      7.0:1
     white on accent #0E6FA6     5.5:1
     cta-ink #1B2C3F on cta      6.2:1  ← vivid orange keeps AA with dark text,
                                          which white on orange (2.3:1) cannot.
   --mk-bright is a GRAPHICS-ONLY fill. It is never used for text on light. */
.mk {
  --mk-bg: #F4F7FA;
  --mk-bg-deep: #E8EEF4;
  --mk-ink: #1B2C3F;
  --mk-ink-soft: #42566B;
  --mk-muted: #556B82;
  --mk-line: #D7E0EA;
  --mk-line-strong: #B6C4D4;
  --mk-surface: #FFFFFF;
  --mk-accent: #0E6FA6;
  --mk-accent-hover: #0B6291;
  --mk-accent-active: #09547C;
  --mk-bright: #29ABE2;
  --mk-navy: #12212F;
  --mk-cta: #F7941E;
  --mk-cta-hover: #FFA338;
  --mk-cta-ink: #1B2C3F;
  --mk-gold: #F5C542;
  --mk-teal: #0D9B8A;
  --mk-sky: #7DD3FC;
  --mk-good: #0B7A5C;
  --mk-warn: #B4530A;
  --mk-bad: #A93226;
  --mk-system: #6D3BE4;
  --mk-danger: #A93226;
  /* One family. Display differs from body by SIZE, WEIGHT and TRACKING rather
     than by a second typeface — which is how modern product marketing reads as
     software instead of as a poster. */
  --mk-font-display: var(--font-sans);
  --mk-font-body: var(--font-sans);
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
  font-weight: 600; font-size: 1.05rem; letter-spacing: -.02em;
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
/* Conversion CTA — vivid orange with dark ink, the one pairing that keeps the
   reference palette's energy without dropping below AA. */
.mk-btn-cta { background: var(--mk-cta); color: var(--mk-cta-ink); font-weight: 600; }
.mk-btn-cta:hover:not(:disabled) { background: var(--mk-cta-hover); }
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
  font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
  color: var(--mk-muted); margin: 0 0 12px;
}
.mk-h2 {
  font-family: var(--mk-font-display);
  font-size: clamp(28px, 4vw, 40px); line-height: 1.14; letter-spacing: -.028em;
  font-weight: 600; margin: 0 0 14px; max-width: 20ch;
}
.mk-lead {
  margin: 0; max-width: 52ch; color: var(--mk-ink-soft); font-size: 17px; line-height: 1.55;
}
.mk-section-head { margin-bottom: clamp(28px, 5vw, 40px); }

/* ── Hero ── */
.mk-hero {
  position: relative; overflow: hidden;
  min-height: min(78vh, 760px);
  display: flex; align-items: flex-end;
  padding: clamp(64px, 10vh, 96px) 0 clamp(40px, 7vh, 72px);
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
/* Audit-led hero: one centred column, because the audit form IS the hero and a
   second column would compete with the only action on the page. */
.mk-hero-audit {
  min-height: auto; align-items: center;
  padding: clamp(48px, 8vh, 84px) 0 clamp(48px, 8vh, 80px);
  background:
    radial-gradient(1100px 560px at 80% 10%, color-mix(in srgb, var(--mk-bright) 20%, transparent), transparent 60%),
    radial-gradient(800px 460px at 8% 92%, color-mix(in srgb, var(--mk-cta) 12%, transparent), transparent 58%),
    linear-gradient(165deg, #EDF3F9 0%, #F7FAFC 45%, #E6EFF6 100%);
}
.mk-hero-audit .mk-hero-inner { grid-template-columns: minmax(0, 1fr); }
.mk-hero-audit .mk-hero-copy { max-width: 48rem; margin-inline: auto; text-align: center; }
.mk-hero-audit .ad-form { text-align: left; max-width: 36rem; margin-inline: auto; }
.mk-hero-audit .ad-prompt { text-align: center; }
.mk-hero-audit .ad-micro { text-align: center; }

/* Soft depth layers behind the hero CTA — parallax-ish drift, not card chrome */
.mk-hero-depth {
  position: absolute; inset: -8% -4%; pointer-events: none; z-index: 0;
  perspective: 900px; transform-style: preserve-3d; overflow: hidden;
}
.mk-depth-orb {
  position: absolute; border-radius: 50%;
  filter: blur(2px);
  will-change: transform;
}
.mk-depth-orb-a {
  width: min(42vw, 420px); height: min(42vw, 420px);
  left: -6%; top: 12%;
  background: radial-gradient(circle at 35% 35%, rgba(37,99,235,.28), rgba(37,99,235,.04) 62%, transparent 72%);
  animation: mkDepthFloatA 14s var(--ease-inout) infinite;
}
.mk-depth-orb-b {
  width: min(36vw, 340px); height: min(36vw, 340px);
  right: -4%; bottom: 8%;
  background: radial-gradient(circle at 60% 40%, rgba(232,121,58,.22), rgba(232,121,58,.03) 60%, transparent 72%);
  animation: mkDepthFloatB 18s var(--ease-inout) infinite;
}
.mk-depth-orb-c {
  width: min(28vw, 260px); height: min(28vw, 260px);
  left: 42%; top: -4%;
  background: radial-gradient(circle at 50% 50%, rgba(15,23,42,.08), transparent 70%);
  animation: mkDepthFloatC 22s var(--ease-inout) infinite;
}
.mk-depth-ring {
  position: absolute; border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--mk-accent) 22%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #fff 40%, transparent);
  transform: rotateX(62deg) rotateZ(-18deg);
  animation: mkDepthSpin 26s linear infinite;
}
.mk-depth-ring-a {
  width: min(58vw, 520px); height: min(58vw, 520px);
  right: 4%; top: 18%;
  opacity: .55;
}
.mk-depth-ring-b {
  width: min(40vw, 360px); height: min(40vw, 360px);
  left: 6%; bottom: 10%;
  opacity: .4;
  animation-duration: 34s;
  animation-direction: reverse;
  border-color: color-mix(in srgb, var(--mk-cta) 28%, transparent);
}
/* The CTA block is the one part of the report that SHOULD stay centred. */
.ad-cta { text-align: center; }
.mk-hero-kicker {
  font-family: var(--mk-font-display);
  font-size: 12.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
  color: var(--mk-accent); margin: 0 0 16px;
}
.mk-hero-title {
  font-family: var(--mk-font-display);
  font-size: clamp(32px, 5.6vw, 58px);
  line-height: 1.08; letter-spacing: -.03em; font-weight: 600;
  margin: 0 0 18px; color: var(--mk-ink);
  animation: mkRise .7s var(--ease-out) both;
}
.mk-hero-audit .mk-hero-support {
  margin-inline: auto; margin-bottom: 32px; max-width: 52ch; font-size: 17.5px;
}
/* Category badge — the first thing read, so it states the product plainly. */
.mk-badge {
  display: inline-flex; align-items: center; gap: 8px;
  margin: 0 0 18px; padding: 7px 14px 7px 12px;
  border-radius: 999px; background: var(--mk-surface);
  border: 1px solid var(--mk-line);
  font-size: 13px; font-weight: 600; letter-spacing: -.005em; color: var(--mk-ink-soft);
  box-shadow: 0 1px 2px rgba(18,33,47,.05);
}
.mk-badge-dot {
  width: 7px; height: 7px; border-radius: 50%; flex: none;
  background: var(--mk-bright);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mk-bright) 22%, transparent);
}

/* Intelligence pillars — compete / diagnose / prioritize / execute & prove.
   Longer than a content-mill checklist on purpose. */
.mk-loop {
  list-style: none; margin: 30px 0 0; padding: 0;
  display: grid; gap: 10px;
  counter-reset: mkloop;
  text-align: left;
}
${up.sm} { .mk-loop { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; } }
.mk-loop li {
  position: relative; padding: 14px 14px 14px 16px;
  border-radius: 12px; background: var(--mk-surface);
  border: 1px solid var(--mk-line);
  display: grid; gap: 3px; align-content: start;
}
.mk-loop li::before {
  content: ""; position: absolute; left: 0; top: 14px; bottom: 14px;
  width: 3px; border-radius: 0 3px 3px 0; background: var(--mk-bright);
}
.mk-loop li:nth-child(2)::before { background: var(--mk-accent); }
.mk-loop li:nth-child(3)::before { background: var(--mk-cta); }
.mk-loop li:nth-child(4)::before { background: var(--mk-teal); }
.mk-loop b {
  font-size: 14.5px; font-weight: 600; letter-spacing: -.015em; color: var(--mk-ink);
}
.mk-loop span { font-size: 12.5px; color: var(--mk-muted); line-height: 1.4; }

.mk-hero-alt { margin: 20px 0 0; font-size: 14px; color: var(--mk-muted); }
.mk-hero-alt a { color: var(--mk-accent); font-weight: 600; text-decoration: none; }
.mk-hero-alt a:hover { text-decoration: underline; }

.mk-hero-copy { max-width: 34rem; }
.mk-hero-support {
  margin: 0 0 28px; color: var(--mk-ink-soft); font-size: 17px; max-width: 38ch;
  animation: mkRise .7s var(--ease-out) .14s both;
}

/* The two-column hero (brand wordmark + CSS product mock) was replaced by the
   audit-led hero, so its rules are removed rather than left orphaned. */

/* ── How it works ── */
.mk-steps {
  list-style: none; margin: 0; padding: 0;
  display: grid; gap: 0;
  counter-reset: mkstep;
}
${up.sm} {
  .mk-steps { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; }
  .mk-steps-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px 0; }
}
${up.md} {
  .mk-steps-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0; }
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
  font-size: 13px; font-weight: 600; letter-spacing: .06em;
  color: var(--mk-accent); margin-bottom: 10px;
}
.mk-step h3 {
  font-family: var(--mk-font-display); font-size: 18px; margin: 0 0 8px;
  letter-spacing: -.018em; font-weight: 600;
}
.mk-step p { margin: 0; color: var(--mk-ink-soft); font-size: 14.5px; }

/* ── Work performed ── */
.mk-work {
  list-style: none; margin: 0; padding: 0;
  display: grid; gap: 22px;
}
${up.sm} { .mk-work { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 36px; } }
${up.md} { .mk-work-dense { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px 28px; } }
.mk-work li { padding-top: 16px; border-top: 1px solid var(--mk-line); }
.mk-work h3 {
  font-family: var(--mk-font-display); font-size: 19px; margin: 0 0 8px;
  letter-spacing: -.018em; font-weight: 600;
}
.mk-work p { margin: 0; color: var(--mk-ink-soft); font-size: 15px; max-width: 40ch; }
.mk-work-dense h3 { font-size: 17px; }
.mk-work-dense p { font-size: 14.5px; max-width: none; }

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
  letter-spacing: -.018em; font-weight: 600;
}
.mk-trust-grid p { margin: 0; color: var(--mk-ink-soft); font-size: 15px; }

/* ── Social proof (MarketingProof) ── */
.mk-proof {
  background:
    radial-gradient(700px 320px at 10% 0%, color-mix(in srgb, var(--mk-bright) 10%, transparent), transparent 60%),
    var(--mk-bg);
}
.mk-proof-logos-label {
  margin: 0 0 14px; text-align: center;
  font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
  color: var(--mk-muted);
}
.mk-proof-logos {
  list-style: none; margin: 0 0 40px; padding: 0;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 12px;
}
.mk-proof-logos li {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 999px;
  background: var(--mk-surface); border: 1px solid var(--mk-line);
  font-size: 13px; font-weight: 600; letter-spacing: -.01em; color: var(--mk-ink-soft);
}
.mk-proof-mark {
  width: 8px; height: 8px; border-radius: 2px; flex: none;
  background: linear-gradient(135deg, var(--mk-bright), var(--mk-cta));
}
.mk-proof-logos li:nth-child(2) .mk-proof-mark { background: linear-gradient(135deg, var(--mk-teal), var(--mk-accent)); }
.mk-proof-logos li:nth-child(3) .mk-proof-mark { background: linear-gradient(135deg, var(--mk-cta), var(--mk-gold)); }
.mk-proof-logos li:nth-child(4) .mk-proof-mark { background: linear-gradient(135deg, var(--mk-accent), var(--mk-navy)); }
.mk-proof-logos li:nth-child(5) .mk-proof-mark { background: linear-gradient(135deg, var(--mk-gold), var(--mk-orange, var(--mk-cta))); }
.mk-proof-logos li:nth-child(6) .mk-proof-mark { background: linear-gradient(135deg, var(--mk-sky), var(--mk-teal)); }

.mk-proof-reviews {
  list-style: none; margin: 0 0 36px; padding: 0;
  display: grid; gap: 14px;
}
${up.md} { .mk-proof-reviews { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; } }
.mk-proof-review {
  background: var(--mk-surface); border: 1px solid var(--mk-line);
  border-radius: 16px; padding: 22px 20px 20px;
  display: grid; gap: 18px; align-content: space-between;
}
.mk-proof-quote {
  margin: 0; font-size: 15px; line-height: 1.55; color: var(--mk-ink);
  letter-spacing: -.01em;
}
.mk-proof-attr { display: grid; gap: 2px; }
.mk-proof-attr strong {
  font-size: 13.5px; font-weight: 620; color: var(--mk-ink); letter-spacing: -.01em;
}
.mk-proof-attr span { font-size: 12.5px; color: var(--mk-muted); }

.mk-proof-stack {
  list-style: none; margin: 0; padding: 0;
  display: grid; gap: 10px;
  grid-template-columns: 1fr;
}
${up.sm} { .mk-proof-stack { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
${up.md} { .mk-proof-stack { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.mk-proof-stack li {
  padding: 14px 16px; border-radius: 12px;
  background: color-mix(in srgb, var(--mk-surface) 70%, var(--mk-bg-deep));
  border: 1px solid var(--mk-line);
  display: grid; gap: 4px;
}
.mk-proof-stack strong {
  font-size: 13.5px; font-weight: 620; color: var(--mk-ink); letter-spacing: -.01em;
}
.mk-proof-stack span { font-size: 12.5px; color: var(--mk-muted); line-height: 1.4; }

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
    grid-template-columns: 220px 1fr;
    align-items: baseline; gap: 24px;
  }
}
${up.md} {
  .mk-integ {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 36px; border-top: 0;
  }
  .mk-integ li {
    grid-template-columns: 1fr;
    gap: 8px; padding: 22px 0;
    border-top: 1px solid var(--mk-line);
  }
}
.mk-integ strong {
  font-family: var(--mk-font-display); font-size: 17px; font-weight: 600; letter-spacing: -.015em;
}
.mk-status {
  font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
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
  letter-spacing: -.02em; font-weight: 600;
}
.mk-price .mk-price-amt {
  font-family: var(--mk-font-display); font-size: 34px; font-weight: 620;
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
  font-size: 28px; letter-spacing: -.026em; margin: 0 0 6px; font-weight: 600;
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
.mk-auth-site {
  margin: -12px 0 20px; padding: 10px 12px; border-radius: 8px;
  background: color-mix(in srgb, var(--mk-accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--mk-accent) 20%, transparent);
  font-size: 13px; color: var(--mk-ink-soft); word-break: break-all;
}
.mk-auth-site b { color: var(--mk-ink); }
.mk-auth-trust { margin: 12px 0 0; font-size: 12.5px; color: var(--mk-muted); text-align: center; }
.mk-auth-foot { margin: 18px 0 0; font-size: 14px; color: var(--mk-muted); text-align: center; }
.mk-auth-foot a { color: var(--mk-accent); font-weight: 600; text-decoration: none; }
.mk-auth-foot a:hover { text-decoration: underline; }

.mk-social { margin: 20px 0 8px; }
.mk-social-sep {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  color: var(--mk-muted); font-size: 12px;
}
.mk-social-sep::before, .mk-social-sep::after {
  content: ""; flex: 1; height: 1px; background: var(--mk-line);
}
.mk-social-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.mk-social-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 10px 8px; border-radius: var(--radius-sm);
  border: 1px solid var(--mk-line); background: var(--mk-bg);
  color: var(--mk-ink); font-size: 12.5px; font-weight: 600; font-family: inherit;
  cursor: pointer;
  transition: background var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out);
}
.mk-social-btn:hover:not(:disabled) { background: var(--mk-surface); border-color: var(--mk-line-strong); }
.mk-social-btn:disabled { opacity: .6; cursor: default; }
${down.sm} { .mk-social-grid { grid-template-columns: 1fr; } }

/* ── Footer ── */
.mk-footer {
  border-top: 1px solid var(--mk-line);
  padding: 36px 0 48px;
  background: color-mix(in srgb, var(--mk-bg-deep) 55%, var(--mk-bg));
}
.mk-footer-inner { display: grid; gap: 12px; }
.mk-footer-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--mk-font-display); font-weight: 600; letter-spacing: -.02em;
}
.mk-footer-note { margin: 0; color: var(--mk-muted); font-size: 13.5px; max-width: 48ch; }
.mk-footer-links { display: flex; flex-wrap: wrap; gap: 8px 18px; }
.mk-footer-links a {
  color: var(--mk-ink-soft); text-decoration: none; font-size: 13.5px; font-weight: 550;
  min-height: 44px; display: inline-flex; align-items: center;
}
.mk-footer-links a:hover { color: var(--mk-ink); }

/* ══ Audit widget — the conversion path ═══════════════════════════════
   URL capture, scan feedback, partial report, gate. Lives on marketing ground
   so it never inherits portal tokens. */
.ad { width: 100%; }
.ad-form { display: grid; gap: 10px; }
.ad-prompt {
  margin: 0 0 2px; font-size: 13px; font-weight: 600;
  letter-spacing: .02em; color: var(--mk-ink-soft);
}
.ad-stage { position: relative; }
.ad.is-cue .ad-stage { padding-top: 42px; }
.ad-cue {
  position: absolute; left: 14%; top: 0; z-index: 2;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  color: var(--mk-accent);
  animation: adCueBob 1.6s var(--ease-inout) infinite;
  pointer-events: none;
}
.ad-cue-label {
  font-size: 11px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; white-space: nowrap;
  color: var(--mk-accent);
  background: color-mix(in srgb, #fff 82%, transparent);
  border: 1px solid color-mix(in srgb, var(--mk-accent) 22%, transparent);
  border-radius: 999px; padding: 3px 9px;
}
.ad-cue-arrow { display: block; }
.ad-field { min-width: 0; }
/* Label lives in .ad-prompt; Field is hideLabel so the row is input+button only. */
.ad-input-row {
  display: grid; gap: 10px;
  align-items: stretch;
}
${up.sm} { .ad-input-row { grid-template-columns: minmax(0, 1fr) auto; } }
/* Higher specificity than .mk .fld-input so padding/border don't diverge from the CTA */
.mk .ad-input.fld-input,
.mk .ad-submit {
  box-sizing: border-box;
  height: 48px;
  min-height: 48px;
  max-height: 48px;
  padding: 0 16px;
  border-width: 1.5px;
  border-radius: 10px;
  font-size: 15.5px;
  line-height: 1;
}
.mk .ad-input.fld-input {
  width: 100%;
  background: var(--mk-surface); color: var(--mk-ink);
  border-style: solid; border-color: var(--mk-line-strong);
  transition:
    border-color var(--dur-2) var(--ease-out),
    box-shadow var(--dur-2) var(--ease-out);
}
.mk .ad.is-cue .ad-input.fld-input {
  animation: adInputPulse 2.4s var(--ease-inout) infinite;
}
.mk .ad-input.fld-input::placeholder { color: var(--mk-muted); opacity: .75; }
.mk .ad-input.fld-input:hover:not(:disabled) { border-color: var(--mk-accent); }
.mk .ad-input.fld-input:focus {
  outline: none; border-color: var(--mk-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mk-accent) 18%, transparent);
  animation: none;
}
.mk .ad-input.fld-input:disabled { opacity: .65; }
.mk .ad-field .fld-error {
  font-size: 13.5px; font-weight: 600; color: var(--mk-bad); margin-top: 4px;
}
.mk .ad-submit {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0 22px;
  background: var(--mk-cta); color: var(--mk-cta-ink);
  border-style: solid; border-color: var(--mk-cta);
  font-family: inherit; font-weight: 600; letter-spacing: -.01em;
  cursor: pointer; white-space: nowrap;
  transition: background var(--dur-2) var(--ease-out), transform var(--dur-1);
}
.ad-submit:hover:not(:disabled) { background: var(--mk-cta-hover); border-color: var(--mk-cta-hover); }
.ad-submit:active:not(:disabled) { transform: translateY(1px); }
.ad-submit:disabled { cursor: default; }
.ad-micro { margin: 0; font-size: 13px; color: var(--mk-muted); font-weight: 550; }
.ad-error {
  margin: 0; font-size: 13.5px; color: var(--mk-bad); font-weight: 600;
  padding: 10px 12px; border-radius: 8px;
  background: color-mix(in srgb, var(--mk-bad) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--mk-bad) 22%, transparent);
}

/* Scan feedback */
.ad-scan { margin-top: 20px; }
.ad-scan-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.ad-scan-steps li {
  display: flex; align-items: center; gap: 10px;
  font-size: 14.5px; color: var(--mk-muted); font-weight: 550;
}
.ad-scan-steps li.is-active { color: var(--mk-ink); font-weight: 600; }
.ad-scan-steps li.is-done { color: var(--mk-ink-soft); }
.ad-scan-dot {
  width: 9px; height: 9px; border-radius: 50%; flex: none;
  background: var(--mk-line-strong);
}
.ad-scan-steps li.is-active .ad-scan-dot {
  background: var(--mk-bright); animation: adPulse 1.1s var(--ease-inout) infinite;
}
.ad-scan-steps li.is-done .ad-scan-dot { background: var(--mk-good); }

/* Result */
.ad-result {
  margin-top: 24px; background: var(--mk-surface);
  border: 1px solid var(--mk-line); border-radius: 16px;
  padding: clamp(20px, 4vw, 32px);
  box-shadow: 0 18px 48px rgba(18,33,47,.10);
  animation: mkRise .5s var(--ease-out) both;
  /* The audit-led hero centres its copy; the report is dense multi-line reading
     and must not inherit that. Centred body text in a card is hard to scan. */
  text-align: left;
}
.ad-result:focus { outline: none; }
.ad-result-head { display: grid; gap: 20px; align-items: center; }
${up.sm} { .ad-result-head { grid-template-columns: auto minmax(0, 1fr); gap: 28px; } }
.ad-ring { position: relative; width: 128px; height: 128px; flex: none; margin-inline: auto; }
.ad-ring svg { width: 128px; height: 128px; transform: rotate(-90deg); }
.ad-ring-track { fill: none; stroke: var(--mk-bg-deep); stroke-width: 12; }
.ad-ring-value {
  fill: none; stroke-width: 12; stroke-linecap: round;
  transition: stroke-dashoffset .9s var(--ease-out);
}
.ad-ring.is-good .ad-ring-value { stroke: var(--mk-good); }
.ad-ring.is-mixed .ad-ring-value { stroke: var(--mk-cta); }
.ad-ring.is-poor .ad-ring-value { stroke: var(--mk-bad); }
.ad-ring-mid {
  position: absolute; inset: 0; display: flex;
  flex-direction: column; align-items: center; justify-content: center; gap: 0;
}
.ad-ring-mid b {
  font-family: var(--mk-font-display); font-size: 36px; font-weight: 620;
  line-height: 1; letter-spacing: -.03em; color: var(--mk-ink);
}
.ad-ring-mid span { font-size: 11.5px; color: var(--mk-muted); font-weight: 600; }
.ad-result-site {
  margin: 0 0 4px; font-size: 13px; font-weight: 600; color: var(--mk-muted);
  word-break: break-all;
}
.ad-result-verdict {
  font-family: var(--mk-font-display); margin: 0 0 8px;
  font-size: clamp(22px, 3.4vw, 28px); letter-spacing: -.024em; font-weight: 600;
}
.ad-result-verdict.is-good { color: var(--mk-good); }
.ad-result-verdict.is-mixed { color: var(--mk-warn); }
.ad-result-verdict.is-poor { color: var(--mk-bad); }
.ad-result-line { margin: 0 0 12px; font-size: 15.5px; color: var(--mk-ink-soft); }
.ad-result-counts { display: flex; flex-wrap: wrap; gap: 8px; }
.ad-result-counts span {
  font-size: 12.5px; font-weight: 600; padding: 5px 11px; border-radius: 999px;
  border: 1px solid transparent;
}
.ad-result-counts .is-bad {
  color: var(--mk-bad); background: color-mix(in srgb, var(--mk-bad) 9%, transparent);
  border-color: color-mix(in srgb, var(--mk-bad) 22%, transparent);
}
.ad-result-counts .is-warn {
  color: var(--mk-warn); background: color-mix(in srgb, var(--mk-warn) 9%, transparent);
  border-color: color-mix(in srgb, var(--mk-warn) 22%, transparent);
}
.ad-result-counts .is-good {
  color: var(--mk-good); background: color-mix(in srgb, var(--mk-good) 9%, transparent);
  border-color: color-mix(in srgb, var(--mk-good) 22%, transparent);
}

.ad-sub {
  font-family: var(--mk-font-display); font-size: 17px; font-weight: 620;
  letter-spacing: -.02em; margin: 0 0 14px; color: var(--mk-ink);
}
.ad-issues { margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--mk-line); }
.ad-issue {
  padding: 16px 18px; border-radius: 12px; margin-bottom: 12px;
  border: 1px solid var(--mk-line); background: var(--mk-bg);
  border-left: 4px solid var(--mk-line-strong);
}
.ad-issue.is-fail { border-left-color: var(--mk-bad); }
.ad-issue.is-warn { border-left-color: var(--mk-cta); }
.ad-issue-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.ad-issue-top strong {
  font-family: var(--mk-font-display); font-size: 16px; font-weight: 600; letter-spacing: -.015em;
}
.ad-chip {
  font-size: 10.5px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
  padding: 4px 9px; border-radius: 5px;
}
.ad-chip.is-fail { color: #fff; background: var(--mk-bad); }
.ad-chip.is-warn { color: var(--mk-cta-ink); background: var(--mk-cta); }
.ad-issue-detail { margin: 0 0 10px; font-size: 14.5px; color: var(--mk-ink-soft); }
.ad-issue-fix {
  margin: 0; font-size: 14px; color: var(--mk-ink);
  display: flex; gap: 8px; align-items: baseline;
}
.ad-issue-fix span {
  font-size: 10.5px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
  color: var(--mk-accent); flex: none;
}

/* Gate */
.ad-gate {
  margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--mk-line);
}
.ad-locked-list { list-style: none; margin: 0 0 28px; padding: 0; display: grid; gap: 8px; }
.ad-locked-list li {
  position: relative; display: flex; align-items: center; gap: 10px;
  padding: 13px 16px; border-radius: 10px;
  background: var(--mk-bg); border: 1px dashed var(--mk-line-strong);
  overflow: hidden;
}
.ad-lock {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 6px; flex: none;
  background: color-mix(in srgb, var(--mk-accent) 12%, transparent);
  color: var(--mk-accent);
}
.ad-locked-label { font-size: 14.5px; font-weight: 600; color: var(--mk-ink-soft); }
.ad-locked-blur {
  flex: 1; height: 9px; border-radius: 5px; margin-left: 6px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--mk-ink) 16%, transparent),
    color-mix(in srgb, var(--mk-ink) 5%, transparent) 70%,
    transparent);
  filter: blur(1.5px);
}
.ad-module-grid { display: grid; gap: 12px; margin-bottom: 28px; }
${up.sm} { .ad-module-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
${up.md} { .ad-module-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.ad-module {
  padding: 16px; border-radius: 12px;
  border: 1px solid var(--mk-line); background: var(--mk-bg);
  display: grid; gap: 7px; align-content: start;
}
.ad-module strong {
  font-family: var(--mk-font-display); font-size: 15px; font-weight: 600;
  letter-spacing: -.015em; color: var(--mk-ink);
}
.ad-module p { margin: 0; font-size: 13.5px; color: var(--mk-ink-soft); }
.ad-module small { font-size: 12px; color: var(--mk-muted); line-height: 1.45; }

.ad-cta {
  text-align: center; padding: clamp(24px, 4vw, 34px) 20px; border-radius: 14px;
  background:
    radial-gradient(600px 220px at 50% 0%, color-mix(in srgb, var(--mk-bright) 22%, transparent), transparent 70%),
    var(--mk-navy);
  color: #fff;
}
.ad-cta h4 {
  font-family: var(--mk-font-display); margin: 0 0 10px;
  font-size: clamp(20px, 3vw, 26px); font-weight: 600; letter-spacing: -.024em; color: #fff;
}
.ad-cta p { margin: 0 auto 20px; max-width: 46ch; font-size: 15px; color: #C6D4E2; }
.ad-cta-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 52px; padding: 14px 30px; border-radius: 10px;
  background: var(--mk-cta); color: var(--mk-cta-ink);
  font-size: 16.5px; font-weight: 620; letter-spacing: -.01em; text-decoration: none;
  transition: background var(--dur-2) var(--ease-out), transform var(--dur-1);
}
.ad-cta-btn:hover { background: var(--mk-cta-hover); }
.ad-cta-btn:active { transform: translateY(1px); }
.ad-cta-micro { margin: 14px 0 0; font-size: 12.5px; color: #9FB3C6; }
.ad-again {
  display: block; margin: 20px auto 0; padding: 10px 16px; min-height: 44px;
  background: none; border: 0; cursor: pointer; font-family: inherit;
  font-size: 14px; font-weight: 600; color: var(--mk-accent); text-decoration: underline;
}
@keyframes adPulse {
  0%, 100% { transform: scale(1); opacity: .9; }
  50% { transform: scale(1.35); opacity: 1; }
}
@keyframes adCueBob {
  0%, 100% { transform: translateY(0); opacity: .95; }
  50% { transform: translateY(7px); opacity: 1; }
}
@keyframes adInputPulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--mk-accent) 0%, transparent); border-color: var(--mk-line-strong); }
  50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--mk-accent) 14%, transparent); border-color: color-mix(in srgb, var(--mk-accent) 55%, var(--mk-line-strong)); }
}
@keyframes mkDepthFloatA {
  0%, 100% { transform: translate3d(0, 0, 40px) scale(1); }
  50% { transform: translate3d(18px, -22px, 80px) scale(1.06); }
}
@keyframes mkDepthFloatB {
  0%, 100% { transform: translate3d(0, 0, 20px) scale(1); }
  50% { transform: translate3d(-24px, 16px, 60px) scale(1.08); }
}
@keyframes mkDepthFloatC {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(12px, 18px, 30px) scale(1.04); }
}
@keyframes mkDepthSpin {
  from { transform: rotateX(62deg) rotateZ(-18deg); }
  to { transform: rotateX(62deg) rotateZ(342deg); }
}

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

/* ── Intelligence reporting showcase (MarketingCharts) ── */
.mkc {
  background:
    radial-gradient(900px 420px at 12% 8%, color-mix(in srgb, var(--mk-bright) 14%, transparent), transparent 60%),
    radial-gradient(700px 380px at 88% 18%, color-mix(in srgb, var(--mk-cta) 12%, transparent), transparent 55%),
    radial-gradient(640px 360px at 50% 100%, color-mix(in srgb, var(--mk-teal) 10%, transparent), transparent 50%),
    linear-gradient(180deg, var(--mk-bg-deep), var(--mk-bg) 40%, var(--mk-bg));
}
.mkc-board {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}
${up.sm} {
  .mkc-board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mkc-panel-area { grid-column: span 2; }
}
${up.md} {
  .mkc-board {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .mkc-panel-gauge { grid-column: span 2; }
  .mkc-panel-area { grid-column: span 4; }
  .mkc-panel-donut { grid-column: span 2; }
  .mkc-panel-bars { grid-column: span 2; }
  .mkc-panel-cols { grid-column: span 2; }
  .mkc-panel-loop { grid-column: span 6; }
}
.mkc-panel {
  background: var(--mk-surface);
  border: 1px solid var(--mk-line);
  border-radius: 16px;
  padding: 18px 18px 16px;
  display: flex; flex-direction: column; gap: 12px;
  min-height: 0;
  opacity: 0; transform: translateY(16px);
  transition: opacity .55s var(--ease-out), transform .55s var(--ease-out), border-color .3s;
}
.mkc.is-on .mkc-panel { opacity: 1; transform: none; }
.mkc.is-on .mkc-panel:nth-child(2) { transition-delay: .05s; }
.mkc.is-on .mkc-panel:nth-child(3) { transition-delay: .1s; }
.mkc.is-on .mkc-panel:nth-child(4) { transition-delay: .15s; }
.mkc.is-on .mkc-panel:nth-child(5) { transition-delay: .2s; }
.mkc.is-on .mkc-panel:nth-child(6) { transition-delay: .25s; }
.mkc-panel > header h3 {
  margin: 0; font-family: var(--mk-font-display);
  font-size: 15.5px; font-weight: 600; letter-spacing: -.015em; color: var(--mk-ink);
}
.mkc-panel > header p {
  margin: 4px 0 0; font-size: 12.5px; color: var(--mk-muted);
}
.mkc-legend {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-wrap: wrap; gap: 10px 14px;
  font-size: 12px; font-weight: 550; color: var(--mk-ink-soft);
}
.mkc-legend li { display: inline-flex; align-items: center; gap: 6px; }
.mkc-legend i {
  width: 9px; height: 9px; border-radius: 2px; display: inline-block; flex: none;
}
.mkc-legend-stack { flex-direction: column; gap: 8px; justify-content: center; }

.mkc-gauge { position: relative; display: grid; place-items: center; padding-top: 4px; }
.mkc-gauge-readout {
  position: absolute; bottom: 2px; left: 0; right: 0;
  display: grid; place-items: center; gap: 0; text-align: center;
}
.mkc-gauge-readout strong {
  font-family: var(--mk-font-display); font-size: 28px; font-weight: 620;
  letter-spacing: -.03em; line-height: 1; color: var(--mk-ink);
  font-variant-numeric: tabular-nums;
}
.mkc-gauge-readout span { font-size: 12px; font-weight: 550; color: var(--mk-muted); }
.mkc-gauge-arc {
  stroke-dashoffset: 0;
  opacity: 0;
}
.mkc-gauge.is-on .mkc-gauge-arc {
  opacity: 1;
  animation: mkcDraw 1.15s var(--ease-out) both, mkcGlow 2.8s 1.2s ease-in-out infinite;
}

.mkc-area-wrap {
  height: 140px; border-radius: 10px; overflow: hidden;
  background:
    linear-gradient(180deg, transparent 0%, transparent 99%, var(--mk-line) 100%),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 27px,
      color-mix(in srgb, var(--mk-line) 70%, transparent) 28px
    );
}
.mkc-area { width: 100%; height: 100%; display: block; }
.mkc-area-fill { opacity: 0; transform: translateY(8px); }
.mkc-area.is-on .mkc-area-fill {
  animation: mkRise .75s var(--ease-out) both;
}
.mkc-area.is-on .mkc-area-fill-you { animation-delay: .12s; }
.mkc-area-line {
  stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 420; stroke-dashoffset: 420;
}
.mkc-area.is-on .mkc-area-line {
  animation: mkcStroke 1.25s .18s var(--ease-out) forwards;
}
.mkc-area.is-on .mkc-area-line-you { animation-delay: .28s; }
.mkc-area-dot { opacity: 0; transform-origin: center; }
.mkc-area.is-on .mkc-area-dot {
  animation: mkcDotIn .4s var(--ease-out) forwards, mkcDotPulse 2.4s ease-in-out infinite;
}
.mkc-scan { opacity: 0; }
.mkc-area.is-on .mkc-scan {
  animation: mkcScan 3.2s 1s ease-in-out infinite;
}

.mkc-donut { position: relative; margin: 0 auto; }
.mkc-donut-seg { opacity: 0; }
.mkc-donut.is-on .mkc-donut-seg {
  animation: mkcSegIn .7s var(--ease-out) forwards;
}
.mkc-donut-center {
  position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 2px;
}
.mkc-donut-center strong {
  font-family: var(--mk-font-display); font-size: 26px; font-weight: 620;
  letter-spacing: -.03em; line-height: 1; color: var(--mk-ink);
  font-variant-numeric: tabular-nums;
}
.mkc-donut-center span { font-size: 12px; font-weight: 550; color: var(--mk-muted); }
.mkc-donut-row {
  display: flex; align-items: center; justify-content: center; gap: 18px; flex-wrap: wrap;
}

.mkc-bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 11px; }
.mkc-bars-meta {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 12.5px; color: var(--mk-ink-soft); margin-bottom: 5px;
}
.mkc-bars-meta b { font-weight: 620; color: var(--mk-ink); font-variant-numeric: tabular-nums; }
.mkc-bars-track {
  height: 10px; border-radius: 999px; background: var(--mk-bg-deep); overflow: hidden;
}
.mkc-bars-fill {
  display: block; height: 100%; border-radius: 999px; width: 0;
  transform-origin: left center;
  transition: width .85s var(--ease-out);
  position: relative;
}
.mkc-bars.is-on .mkc-bars-fill::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
  animation: mkcShimmer 2.4s ease-in-out infinite;
}

.mkc-cols {
  display: flex; align-items: flex-end; gap: 8px;
  height: 120px; padding: 8px 2px 0;
}
.mkc-col {
  flex: 1; border-radius: 8px 8px 4px 4px; min-width: 0; height: 8%;
  transform-origin: bottom;
  transition: height .8s var(--ease-out);
}
.mkc-cols.is-on .mkc-col {
  animation: mkcColPulse 2.8s ease-in-out infinite;
}

.mkc-timeline {
  list-style: none; margin: 4px 0 0; padding: 0;
  display: flex; flex-wrap: wrap; gap: 8px 0;
  justify-content: space-between; align-items: flex-start;
}
.mkc-timeline > li {
  position: relative; flex: 1 1 64px; min-width: 72px;
  display: grid; justify-items: center; gap: 8px; text-align: center;
  opacity: 0; transform: translateY(8px);
}
.mkc-timeline.is-on > li {
  animation: mkRise .5s var(--ease-out) forwards;
}
.mkc-timeline-node {
  width: 34px; height: 34px; border-radius: 50%;
  display: grid; place-items: center;
  color: #fff; font-size: 13px; font-weight: 620;
  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 12%, transparent);
}
.mkc-timeline.is-on .mkc-timeline-node {
  animation: mkcNodePulse 2.6s ease-in-out infinite;
}
.mkc-timeline-label {
  font-size: 12.5px; font-weight: 600; color: var(--mk-ink-soft);
}
.mkc-timeline-line {
  position: absolute; top: 16px; left: calc(50% + 20px); right: calc(-50% + 20px);
  height: 3px; border-radius: 2px;
  background: linear-gradient(90deg, var(--mk-bright), var(--mk-cta), var(--mk-gold), var(--mk-teal));
  background-size: 200% 100%;
  opacity: .55;
  pointer-events: none;
}
.mkc-timeline.is-on .mkc-timeline-line {
  animation: mkcFlow 2.8s linear infinite;
}

.mkc-note {
  margin: 18px 0 0; text-align: center;
  font-size: 12.5px; color: var(--mk-muted);
}

@keyframes mkcDraw {
  from { stroke-dasharray: 0 340; }
}
@keyframes mkcStroke {
  to { stroke-dashoffset: 0; }
}
@keyframes mkcGlow {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.12); }
}
@keyframes mkcDotIn {
  to { opacity: 1; }
}
@keyframes mkcDotPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.28); }
}
@keyframes mkcScan {
  0% { transform: translateX(0); opacity: 0; }
  8% { opacity: .4; }
  92% { opacity: .25; }
  100% { transform: translateX(280px); opacity: 0; }
}
@keyframes mkcSegIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes mkcShimmer {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
}
@keyframes mkcColPulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.08); }
}
@keyframes mkcNodePulse {
  0%, 100% { box-shadow: 0 0 0 4px color-mix(in srgb, #29ABE2 14%, transparent); }
  50% { box-shadow: 0 0 0 7px color-mix(in srgb, #29ABE2 8%, transparent); }
}
@keyframes mkcFlow {
  from { background-position: 0% 0; }
  to { background-position: 200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .mk-hero::before, .mk-hero-title, .mk-hero-support,
  .ad-scan-dot, .ad-result, .ad-cue, .mk .ad.is-cue .ad-input.fld-input,
  .mk-depth-orb, .mk-depth-ring {
    animation: none !important;
  }
  .mkc-panel { opacity: 1; transform: none; transition: none; }
  .mkc-gauge-arc, .mkc-area-fill, .mkc-area-line, .mkc-area-dot, .mkc-scan,
  .mkc-donut-seg, .mkc-bars-fill::after, .mkc-col, .mkc-timeline > li,
  .mkc-timeline-node, .mkc-timeline-line {
    animation: none !important;
  }
  .mkc-area-line { stroke-dasharray: none; stroke-dashoffset: 0; }
  .mkc-area-fill, .mkc-area-dot, .mkc-donut-seg, .mkc-gauge-arc { opacity: 1; }
  .mkc-bars-fill, .mkc-col { transition: none !important; }
  .ad-ring-value { transition: none !important; }
}

${down.sm} {
  .mk-nav-inner { width: calc(100% - 28px); gap: 8px; }
  .mk-wrap { width: calc(100% - 28px); }
  .mk-nav-links > a:not(.mk-btn) { padding: 10px 6px; font-size: 13.5px; }
  /* At 390px the mark was wrapping to two lines and the links were crushing
     against the trial button. Keep the two conversion actions (Login, Start
     trial) and drop "Product", which the page itself scrolls to anyway. */
  .mk-mark-name { white-space: nowrap; font-size: .98rem; }
  .mk-nav-links > a[href="/#how"] { display: none; }
  .mk-hero { align-items: center; min-height: auto; padding-top: 48px; }
  .mk-auth-card { padding: 28px 22px; border-radius: var(--radius-md); }
  .ad-cue { left: 0; right: 0; width: 100%; }
  .ad-cue-label { font-size: 10.5px; }
  .mk .ad-input.fld-input,
  .mk .ad-submit { height: 46px; min-height: 46px; max-height: 46px; font-size: 15px; }
  .mk .ad-submit { width: 100%; }
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
