"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

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
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div className="card">
        <div className="brand"><span className="dot" /> Autonomous SEO Platform</div>
        <h1>Sign in</h1>
        <p className="sub">Access your site&apos;s SEO command center.</p>
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") signIn(); }}
          autoComplete="email"
        />
        <input
          placeholder="Password"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") signIn(); }}
          autoComplete="current-password"
        />
        {err && <div className="err">⚠️ {err}</div>}
        <button onClick={signIn} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {/* Debug: show whether env vars are loaded */}
        {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <div className="err">Missing NEXT_PUBLIC_SUPABASE_URL — check Vercel env vars.</div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.lg { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(160deg,#F6F8FB,#EEF1FF); font-family:'Space Grotesk',-apple-system,Segoe UI,sans-serif; color:#1A2030; padding:20px; }
.lg .card { width:100%; max-width:390px; background:#fff; border:1px solid #E7EAF0; border-radius:20px; padding:36px; box-shadow:0 12px 40px rgba(16,24,40,.08); }
.lg .brand { display:flex; align-items:center; gap:8px; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:#8A93A6; margin-bottom:22px; }
.lg .dot { width:8px; height:8px; border-radius:50%; background:#6C5CE7; box-shadow:0 0 0 4px rgba(108,92,231,.15); }
.lg h1 { font-size:26px; margin:0 0 4px; color:#12172A; }
.lg .sub { color:#8A93A6; font-size:13px; margin:0 0 24px; }
.lg input { width:100%; background:#F6F8FB; border:1px solid #E7EAF0; color:#1A2030; padding:13px 15px; border-radius:11px; font-size:14px; margin-bottom:12px; font-family:inherit; box-sizing:border-box; }
.lg input:focus { outline:none; border-color:#6C5CE7; background:#fff; }
.lg button { width:100%; background:linear-gradient(135deg,#6C5CE7,#8B5CF6); color:#fff; border:0; padding:14px; border-radius:11px; font-weight:600; font-size:14px; cursor:pointer; font-family:inherit; margin-top:6px; }
.lg button:disabled { opacity:.6; cursor:default; }
.lg .err { color:#E14B4B; font-size:13px; margin-bottom:10px; padding:10px 12px; background:rgba(225,75,75,.08); border-radius:8px; border:1px solid rgba(225,75,75,.2); }
`;
