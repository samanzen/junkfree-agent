"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import MarketingShell from "@/app/_components/MarketingShell";
import Field from "@/app/_components/Field";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/ui/tokens";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function signUp() {
    if (!email || !pw) {
      setErr("Please enter your email and password.");
      return;
    }
    if (pw.length < 8) {
      setErr("Use a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    setErr("");
    setInfo("");
    try {
      const { data, error } = await supabaseBrowser().auth.signUp({
        email,
        password: pw,
      });
      if (error) {
        setErr(error.message);
        setBusy(false);
        return;
      }
      // Some projects require email confirmation before a session exists.
      // Only then do we keep the user on this page with a clear next step.
      if (data.session) {
        router.push("/onboarding");
        return;
      }
      setInfo("Check your email to confirm your account, then sign in to continue setup.");
      setBusy(false);
    } catch (e) {
      setErr("Connection error: " + String(e));
      setBusy(false);
    }
  }

  return (
    <MarketingShell active="signup">
      <main id="main" className="mk-auth">
        <div className="mk-auth-card">
          <h1>Create your account</h1>
          <p className="mk-auth-sub">
            {PLATFORM_NAME} — {PLATFORM_TAGLINE}
          </p>
          <div className="mk-auth-fields">
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
                if (e.key === "Enter") signUp();
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
                if (e.key === "Enter") signUp();
              }}
              autoComplete="new-password"
              helper="At least 8 characters."
              disabled={busy}
            />
          </div>
          {err && (
            <div className="mk-auth-err" role="alert">
              {err}
            </div>
          )}
          {info && (
            <div className="mk-auth-ok" role="status">
              {info}
            </div>
          )}
          <button
            type="button"
            className="mk-btn mk-btn-primary"
            style={{ width: "100%" }}
            onClick={signUp}
            disabled={busy}
            data-busy={busy || undefined}
            aria-live="polite"
          >
            <span>{busy ? "Creating account…" : "Start free trial"}</span>
          </button>
          <p className="mk-auth-foot">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </MarketingShell>
  );
}
