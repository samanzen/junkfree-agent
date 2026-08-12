"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import MarketingShell from "@/app/_components/MarketingShell";
import Field from "@/app/_components/Field";
import { PLATFORM_NAME, TRIAL_DAYS } from "@/lib/ui/tokens";
// The pure shape module, never lib/audit/url: that one imports dns/promises and
// would drag a Node built-in into the browser bundle.
import { checkUrlShape } from "@/lib/audit/url-shape";
import SocialAuthButtons from "@/app/_components/SocialAuthButtons";
import AuthBackdrop from "@/app/_components/AuthBackdrop";
import { destinationForSession } from "@/lib/authDestination";

export default function SignupPage() {
  // useSearchParams needs a Suspense boundary to keep this page prerenderable.
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}

function SignupInner() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [site, setSite] = useState("");

  // The audited URL rides through signup so onboarding does not ask for a
  // website the visitor already gave us on the landing page. Re-validated here
  // rather than trusted: it arrives in a query string a visitor can edit.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("site");
    if (raw) {
      const checked = checkUrlShape(raw);
      if (checked.ok) setSite(checked.url.toString());
    }
    const emailQ = params.get("email");
    if (emailQ && emailQ.includes("@") && emailQ.length < 200) {
      setEmail(emailQ.trim());
    }
  }, []);

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
        // Always land new self-serve accounts on customer onboarding — never the
        // admin console. destinationForSession enforces role → route.
        const dest = await destinationForSession(data.session.access_token, {
          next: "/onboarding",
          site: site || null,
        });
        router.push(dest);
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
        <AuthBackdrop />
        <div className="mk-auth-card">
          <h1>{site ? "Unlock your full report" : "Create your account"}</h1>
          <p className="mk-auth-sub">
            {site
              ? `Your ${TRIAL_DAYS}-day trial of ${PLATFORM_NAME} starts now — no credit card required.`
              : `Start your ${TRIAL_DAYS}-day free trial of ${PLATFORM_NAME}. No credit card required.`}
          </p>
          {site && (
            <p className="mk-auth-site">
              Report for <b>{site.replace(/^https?:\/\//, "").replace(/\/$/, "")}</b>
            </p>
          )}

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
            <span>
              {busy ? "Creating account…" : site ? "Unlock my full report" : "Start free trial"}
            </span>
          </button>

          <SocialAuthButtons
            next="/onboarding"
            site={site || null}
            onError={setErr}
            disabled={busy}
            variant="signup"
          />
          <p className="mk-auth-trust">
            {TRIAL_DAYS}-day trial · No credit card · Cancel anytime
          </p>
          <p className="mk-auth-foot">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </MarketingShell>
  );
}
