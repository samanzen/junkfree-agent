"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { touchTargetCSS, fieldCSS, down, PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/ui/tokens";
import Field from "@/app/_components/Field";
import SocialAuthButtons from "@/app/_components/SocialAuthButtons";
import AuthBackdrop from "@/app/_components/AuthBackdrop";
import { destinationForSession, safeAuthNext } from "@/lib/authDestination";

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeAuthNext(search.get("next"));
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!email || !pw) {
      setErr("Please enter your email and password.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const { data, error } = await supabaseBrowser().auth.signInWithPassword({
        email,
        password: pw,
      });
      if (error) {
        setErr(error.message);
        setBusy(false);
        return;
      }
      router.push(
        await destinationForSession(data.session?.access_token, {
          next: next || undefined,
        })
      );
    } catch (e) {
      setErr("Connection error: " + String(e));
      setBusy(false);
    }
  }

  return (
    <div className="lg">
      <style>{CSS}</style>
      <AuthBackdrop />
      <main className="card">
        <div className="brand">
          <span className="dot" /> {PLATFORM_NAME}
        </div>
        <h1>Sign in</h1>
        <p className="sub">{PLATFORM_TAGLINE}</p>
        <p className="sub-note">Customer workspace — not the admin console.</p>

        <div className="lg-fields">
          <Field
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (err) setErr("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") signIn();
            }}
            autoComplete="email"
            disabled={busy}
          />
          <Field
            label="Password"
            type="password"
            required
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (err) setErr("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") signIn();
            }}
            autoComplete="current-password"
            disabled={busy}
          />
        </div>
        {err && (
          <div className="err" role="alert">
            {err}
          </div>
        )}
        <button onClick={signIn} disabled={busy} data-busy={busy || undefined} aria-live="polite">
          <span>{busy ? "Signing in…" : "Sign in with email"}</span>
        </button>

        <SocialAuthButtons
          next={next || "/portal"}
          onError={setErr}
          disabled={busy}
          variant="login"
        />

        <p className="signup-link">
          New customer? <a href="/signup">Create an account</a>
          <span className="signup-hint"> — you&apos;ll set up your business workspace, not the admin console.</span>
        </p>
        {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <div className="err">Missing NEXT_PUBLIC_SUPABASE_URL — check Vercel env vars.</div>
        )}
      </main>
    </div>
  );
}

const CSS = `
.lg {
  position:relative; isolation:isolate; overflow:hidden;
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  background:
    radial-gradient(1100px 560px at 82% 12%, rgba(37,99,235,.16), transparent 58%),
    radial-gradient(900px 520px at 10% 90%, rgba(247,148,30,.10), transparent 55%),
    linear-gradient(165deg, #EEF2F8 0%, #F7F8FB 42%, #E7EDF7 100%);
  font-family:var(--font-sans); color:#1A2030; padding:20px;
}
.lg .card {
  position:relative; z-index:1;
  width:100%; max-width:390px; background:#fff; border:1px solid #E7EAF0;
  border-radius:var(--radius-lg); padding:36px; box-shadow:var(--shadow-4);
}
.lg .brand { display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:#616C82; margin-bottom:22px; }
.lg .dot { width:8px; height:8px; border-radius:50%; background:#2563EB; box-shadow:0 0 0 4px rgba(37,99,235,.16); }
.lg h1 { font-size:26px; margin:0 0 4px; color:#12172A; }
.lg .sub { color:#616C82; font-size:13px; margin:0 0 6px; }
.lg .sub-note { color:#616C82; font-size:12px; margin:0 0 20px; }
.lg-fields { display:flex; flex-direction:column; gap:16px; margin-bottom:16px; }
.lg button:not(.lg-social-btn) { width:100%; background:#2563EB; color:#fff; border:0; padding:14px; border-radius:var(--radius-sm); font-weight:600; font-size:14px; cursor:pointer; font-family:inherit; margin-top:6px; transition:background var(--dur-2) var(--ease-out), transform var(--dur-1); }
.lg button:not(.lg-social-btn):hover:not(:disabled) { background:#1D4FD8; }
.lg button:active { transform:translateY(1px); }
.lg button:not(.lg-social-btn):active:not(:disabled) { background:#1A45BE; }
.lg button:disabled { opacity:.6; cursor:default; }
.lg .err { color:#B3261E; font-size:13px; margin-bottom:10px; padding:10px 12px; background:rgba(179,38,30,.08); border-radius:var(--radius-sm); border:1px solid rgba(179,38,30,.2); }
.lg .signup-link { margin:18px 0 0; text-align:center; font-size:13.5px; color:#616C82; }
.lg .signup-link a { color:#2563EB; font-weight:600; text-decoration:none; }
.lg .signup-link a:hover { text-decoration:underline; }
.lg .signup-hint { display:block; margin-top:6px; font-size:12px; color:#616C82; }
.lg-social { margin-top:18px; margin-bottom:4px; }
.lg-social-sep { display:flex; align-items:center; gap:10px; margin-bottom:12px; color:#616C82; font-size:12px; }
.lg-social-sep::before, .lg-social-sep::after { content:""; flex:1; height:1px; background:#E7EAF0; }
.lg-social-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
.lg-social-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  min-height:44px; padding:10px 8px; border-radius:var(--radius-sm);
  border:1px solid #E7EAF0; background:#F6F8FB; color:#1A2030;
  font-size:12.5px; font-weight:600; font-family:inherit; cursor:pointer;
  transition:background var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out);
}
.lg-social-btn:hover:not(:disabled) { background:#fff; border-color:#C6CEDA; }
.lg-social-btn:active:not(:disabled) { transform:translateY(1px); }
${fieldCSS(".lg", {
  surface: "#F6F8FB", line: "#E7EAF0", lineStrong: "#C6CEDA", muted: "#616C82",
  text: "#1A2030", accent: "#2563EB", danger: "#B3261E", radius: "var(--radius-sm)",
})}
${touchTargetCSS(".lg")}
${down.sm} {
  .lg { padding:20px 16px; align-items:flex-start; padding-top:12vh; }
  .lg .card { padding:26px 22px; border-radius:var(--radius-md); }
  .lg-social-grid { grid-template-columns:1fr; }
}
`;
