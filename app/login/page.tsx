"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.push("/dashboard");
  }

  return (
    <div className="lg">
      <style>{CSS}</style>
      <div className="card">
        <div className="brand"><span className="dot" /> Autonomous SEO Platform</div>
        <h1>Sign in</h1>
        <p className="sub">Access your site&apos;s SEO command center.</p>
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") signIn(); }} />
        {err && <div className="err">{err}</div>}
        <button onClick={signIn} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </div>
    </div>
  );
}

const CSS = `
.lg { min-height:100vh; display:flex; align-items:center; justify-content:center; background:radial-gradient(900px 500px at 50% -10%, rgba(52,224,196,.08), transparent 60%), #0B0F17; font-family:'Space Grotesk',-apple-system,Segoe UI,sans-serif; color:#E6EBF2; padding:20px; }
.lg .card { width:100%; max-width:380px; background:#141B26; border:1px solid #263041; border-radius:16px; padding:32px; }
.lg .brand { display:flex; align-items:center; gap:8px; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#7E8CA0; margin-bottom:20px; }
.lg .dot { width:7px; height:7px; border-radius:50%; background:#34E0C4; }
.lg h1 { font-size:24px; margin:0 0 4px; }
.lg .sub { color:#7E8CA0; font-size:13px; margin:0 0 22px; }
.lg input { width:100%; background:#0B0F17; border:1px solid #263041; color:#E6EBF2; padding:12px 14px; border-radius:9px; font-size:14px; margin-bottom:12px; font-family:inherit; }
.lg input:focus { outline:none; border-color:#34E0C4; }
.lg button { width:100%; background:#34E0C4; color:#04231e; border:0; padding:13px; border-radius:9px; font-weight:600; font-size:14px; cursor:pointer; font-family:inherit; margin-top:6px; }
.lg button:disabled { opacity:.6; }
.lg .err { color:#FF6B6B; font-size:13px; margin-bottom:10px; }
`;
