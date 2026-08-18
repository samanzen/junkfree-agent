/**
 * Atmospheric plane behind auth forms (login / signup).
 * The card stays clean; this fills the empty wall behind it with the same
 * depth language as the marketing hero — grid, aurora, drifting orbs/rings.
 */
export default function AuthBackdrop() {
  return (
    <div className="auth-bd" aria-hidden="true">
      <div className="auth-bd-grid" />
      <div className="auth-bd-aurora" />
      <div className="auth-bd-depth">
        <span className="auth-bd-orb auth-bd-orb-a" />
        <span className="auth-bd-orb auth-bd-orb-b" />
        <span className="auth-bd-orb auth-bd-orb-c" />
        <span className="auth-bd-ring auth-bd-ring-a" />
        <span className="auth-bd-ring auth-bd-ring-b" />
        <span className="auth-bd-beam auth-bd-beam-a" />
        <span className="auth-bd-beam auth-bd-beam-b" />
        <span className="auth-bd-node auth-bd-node-a" />
        <span className="auth-bd-node auth-bd-node-b" />
        <span className="auth-bd-node auth-bd-node-c" />
        <span className="auth-bd-node auth-bd-node-d" />
      </div>
      {/* Soft vignette so the card remains the focus */}
      <div className="auth-bd-vignette" />
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.auth-bd {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.auth-bd-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(37,99,235,.10) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37,99,235,.10) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 90% 80% at 50% 45%, #000 30%, transparent 85%);
  animation: authBdGrid 22s linear infinite;
  opacity: .9;
}
.auth-bd-aurora {
  position: absolute; inset: -18% -10%;
  background:
    radial-gradient(ellipse 44% 36% at 78% 16%, rgba(37,99,235,.26), transparent 70%),
    radial-gradient(ellipse 40% 34% at 14% 82%, rgba(247,148,30,.18), transparent 68%),
    radial-gradient(ellipse 32% 28% at 48% 6%, rgba(41,171,226,.14), transparent 70%);
  animation: authBdAurora 14s ease-in-out infinite alternate;
}
.auth-bd-depth {
  position: absolute; inset: -8% -4%;
  perspective: 1100px;
  transform-style: preserve-3d;
}
.auth-bd-orb {
  position: absolute; border-radius: 50%;
  mix-blend-mode: multiply;
  will-change: transform, opacity;
}
.auth-bd-orb-a {
  width: min(52vw, 520px); height: min(52vw, 520px);
  left: -10%; top: 4%;
  background: radial-gradient(circle at 35% 35%, rgba(37,99,235,.45), rgba(37,99,235,.12) 48%, transparent 70%);
  animation: authBdFloatA 11s ease-in-out infinite;
  opacity: .95;
}
.auth-bd-orb-b {
  width: min(44vw, 420px); height: min(44vw, 420px);
  right: -8%; bottom: 0%;
  background: radial-gradient(circle at 60% 40%, rgba(247,148,30,.40), rgba(247,148,30,.10) 50%, transparent 72%);
  animation: authBdFloatB 14s ease-in-out infinite;
  opacity: .95;
}
.auth-bd-orb-c {
  width: min(36vw, 340px); height: min(36vw, 340px);
  left: 36%; top: -8%;
  background: radial-gradient(circle at 50% 50%, rgba(15,23,42,.16), rgba(41,171,226,.12) 55%, transparent 72%);
  animation: authBdFloatC 17s ease-in-out infinite;
}
.auth-bd-ring {
  position: absolute; border-radius: 50%;
  border: 2px solid rgba(37,99,235,.38);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.5),
    0 0 0 8px rgba(37,99,235,.06);
  transform: rotateX(58deg) rotateZ(-18deg);
  animation: authBdSpin 22s linear infinite;
}
.auth-bd-ring-a {
  width: min(64vw, 580px); height: min(64vw, 580px);
  right: 0%; top: 10%;
  opacity: .7;
}
.auth-bd-ring-b {
  width: min(46vw, 420px); height: min(46vw, 420px);
  left: 2%; bottom: 4%;
  opacity: .55;
  animation-duration: 30s;
  animation-direction: reverse;
  border-color: rgba(247,148,30,.42);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.4),
    0 0 0 8px rgba(247,148,30,.07);
}
.auth-bd-beam {
  position: absolute; height: 2px; border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(37,99,235,.55), transparent);
  transform-origin: left center;
  opacity: .55;
  animation: authBdBeam 7.5s ease-in-out infinite;
}
.auth-bd-beam-a {
  width: min(48vw, 440px); left: 6%; top: 30%;
  transform: rotate(-18deg);
}
.auth-bd-beam-b {
  width: min(40vw, 360px); right: 8%; bottom: 28%;
  transform: rotate(14deg);
  animation-delay: 1.5s;
  background: linear-gradient(90deg, transparent, rgba(247,148,30,.5), transparent);
}
.auth-bd-node {
  position: absolute; width: 10px; height: 10px; border-radius: 50%;
  background: #2563EB;
  box-shadow: 0 0 0 6px rgba(37,99,235,.16);
  animation: authBdPulse 2.8s ease-in-out infinite;
}
.auth-bd-node-a { left: 12%; top: 20%; }
.auth-bd-node-b {
  right: 16%; top: 32%; animation-delay: .7s;
  background: #F7941E; box-shadow: 0 0 0 6px rgba(247,148,30,.18);
}
.auth-bd-node-c { left: 26%; bottom: 16%; animation-delay: 1.3s; }
.auth-bd-node-d {
  right: 24%; bottom: 22%; animation-delay: 1.9s;
  background: #F7941E; box-shadow: 0 0 0 6px rgba(247,148,30,.18);
}
.auth-bd-vignette {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 70% 60% at 50% 48%, rgba(255,255,255,.55), transparent 72%),
    linear-gradient(180deg, rgba(246,248,251,.15), transparent 28%, transparent 72%, rgba(231,237,247,.35));
}

@keyframes authBdGrid {
  from { background-position: 0 0, 0 0; }
  to { background-position: 56px 56px, 56px 56px; }
}
@keyframes authBdAurora {
  from { transform: translate3d(-3%, 1%, 0) scale(1); opacity: .85; }
  to { transform: translate3d(4%, -2%, 0) scale(1.08); opacity: 1; }
}
@keyframes authBdFloatA {
  0%, 100% { transform: translate3d(0, 0, 40px) scale(1); }
  50% { transform: translate3d(36px, -40px, 110px) scale(1.12); }
}
@keyframes authBdFloatB {
  0%, 100% { transform: translate3d(0, 0, 20px) scale(1); }
  50% { transform: translate3d(-42px, 28px, 90px) scale(1.14); }
}
@keyframes authBdFloatC {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(24px, 30px, 50px) scale(1.1); }
}
@keyframes authBdSpin {
  from { transform: rotateX(58deg) rotateZ(-18deg); }
  to { transform: rotateX(58deg) rotateZ(342deg); }
}
@keyframes authBdBeam {
  0%, 100% { opacity: .25; filter: saturate(.9); }
  50% { opacity: .75; filter: saturate(1.15); }
}
@keyframes authBdPulse {
  0%, 100% { transform: scale(1); opacity: .7; }
  50% { transform: scale(1.35); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .auth-bd-grid, .auth-bd-aurora, .auth-bd-orb, .auth-bd-ring,
  .auth-bd-beam, .auth-bd-node {
    animation: none !important;
  }
}
@media (max-width: 639px) {
  .auth-bd-beam, .auth-bd-node-c, .auth-bd-node-d { display: none; }
  .auth-bd-orb-a, .auth-bd-orb-b { opacity: .8; }
}
`;
