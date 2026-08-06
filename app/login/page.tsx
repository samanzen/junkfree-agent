"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { touchTargetCSS, fieldCSS, down } from "@/lib/ui/tokens";
import Field from "@/app/_components/Field";

// Where to send someone straight after they sign in. Role comes from the
// existing /api/me endpoint (lib/auth.ts) -- this adds no new auth logic and
// changes no permissions; it only picks the landing route.
//
// Falls back to /portal if the role lookup fails: that's the least-privileged
// surface, and an admin who lands there still gets an explicit "back to admin"
// link, whereas a customer sent to /dashboard would face admin tooling.
async function destinationForSession(token?: string): Promise<string> {
  try {
    const res = await fetch("/api/me", token ? { headers: { authorization: `Bearer ${token}` } } : {});
    if (!res.ok) return "/portal";
    const me = await res.json();
    return me.role === "admin" ? "/dashboard" : "/portal";
  } catch {
    return "/portal";
  }
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!email || !pw) { setErr("Please enter your email and password."); return; }
    setBusy(true); setErr("");
    try {
      const { data, error } = await supabaseBrowser().auth.signInWithPassword({ email, password: pw });
      if (error) {
        // Show the actual error message so we can debug
        setErr(error.message);
        setBusy(false);
        return;
      }
      router.push(await destinationForSession(data.session?.access_token));
    } catch (e) {
      setErr("Connection error: " + String(e));
      setBusy(false);
    }
  }

  return (
    <div className="lg">
      {/* Fonts come from next/font in app/layout.tsx now — no external request. */}
      <style>{CSS}</style>
      <main className="card">
        <div className="brand"><span className="dot" /> Autonomous SEO Platform</div>
        <h1>Sign in</h1>
        <p className="sub">Access your site&apos;s SEO command center.</p>
        <div className="lg-fields">
          <Field
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (err) setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") signIn(); }}
            autoComplete="email"
            disabled={busy}
          />
          <Field
            label="Password"
            type="password"
            required
            value={pw}
            onChange={(e) => { setPw(e.target.value); if (err) setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") signIn(); }}
            autoComplete="current-password"
            disabled={busy}
          />
        </div>
        {/* role="alert" so a failed sign-in is announced, and the message is
            cleared as soon as the user edits either field. */}
        {err && <div className="err" role="alert">{err}</div>}
        <button onClick={signIn} disabled={busy} data-busy={busy || undefined} aria-live="polite">
          <span>{busy ? "Signing in…" : "Sign in"}</span>
        </button>
        {/* Debug: show whether env vars are loaded */}
        {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <div className="err">Missing NEXT_PUBLIC_SUPABASE_URL — check Vercel env vars.</div>
        )}
      </main>
    </div>
  );
}

const CSS = `
.lg { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(160deg,#F6F8FB,#EEF1FF); font-family:var(--font-sans); color:#1A2030; padding:20px; }
.lg .card { width:100%; max-width:390px; background:#fff; border:1px solid #E7EAF0; border-radius:20px; padding:36px; box-shadow:0 12px 40px rgba(16,24,40,.08); }
.lg .brand { display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:#8A93A6; margin-bottom:22px; }
.lg .dot { width:8px; height:8px; border-radius:50%; background:#6C5CE7; box-shadow:0 0 0 4px rgba(108,92,231,.15); }
.lg h1 { font-size:26px; margin:0 0 4px; color:#12172A; }
.lg .sub { color:#8A93A6; font-size:13px; margin:0 0 24px; }
/* Input styling now comes from the shared fieldCSS below. The old bare
   ".lg input" rule carried its own margin, which would have fought the
   field layout's gap. */
.lg-fields { display:flex; flex-direction:column; gap:15px; margin-bottom:16px; }
.lg button { width:100%; background:linear-gradient(135deg,#6C5CE7,#8B5CF6); color:#fff; border:0; padding:14px; border-radius:11px; font-weight:600; font-size:14px; cursor:pointer; font-family:inherit; margin-top:6px; }
.lg button:disabled { opacity:.6; cursor:default; }
.lg .err { color:#E14B4B; font-size:13px; margin-bottom:10px; padding:10px 12px; background:rgba(225,75,75,.08); border-radius:8px; border:1px solid rgba(225,75,75,.2); }

/* ══ Phase 4: shared form fields ══════════════════════════════════════════ */
${fieldCSS(".lg", {
  surface: "#F6F8FB", line: "#E7EAF0", lineStrong: "#C6CEDA", muted: "#8A93A6",
  text: "#1A2030", accent: "#6C5CE7", danger: "#E14B4B", radius: "11px",
})}
${touchTargetCSS(".lg")}
${down.sm} {
  .lg { padding:20px 16px; align-items:flex-start; padding-top:12vh; }
  .lg .card { padding:26px 22px; border-radius:16px; }
}
`;
