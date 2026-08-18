"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { destinationForSession, safeAuthNext } from "@/lib/authDestination";
import { PLATFORM_NAME } from "@/lib/ui/tokens";

// Supabase OAuth return path. Exchanges ?code= for a session, then routes by role:
// admin → /dashboard, new customer → /onboarding, else → /portal (or ?next=).

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Shell message="Signing you in…" />}>
      <CallbackInner />
    </Suspense>
  );
}

function CallbackInner() {
  const router = useRouter();
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const next = safeAuthNext(params.get("next"));
      const site = params.get("site");
      const oauthErr = params.get("error_description") || params.get("error");

      if (oauthErr) {
        if (!cancelled) setErr(oauthErr);
        return;
      }

      try {
        const supabase = supabaseBrowser();
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (!cancelled) setErr(error.message);
            return;
          }
        }
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) setErr("Sign-in didn't complete. Please try again.");
          return;
        }
        const dest = await destinationForSession(data.session.access_token, {
          next: next || "/onboarding",
          site,
        });
        if (!cancelled) router.replace(dest);
      } catch (e) {
        if (!cancelled) setErr("Connection error: " + String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (err) {
    return (
      <Shell message={err} error>
        <Link href="/login">Back to sign in</Link>
        {" · "}
        <Link href="/signup">Create an account</Link>
      </Shell>
    );
  }
  return <Shell message="Signing you in…" />;
}

function Shell({
  message,
  error,
  children,
}: {
  message: string;
  error?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeContent: "center",
        padding: 24,
        fontFamily: "var(--font-sans)",
        background: "#F4F7FA",
        color: "#1B2C3F",
        textAlign: "center",
      }}
    >
      <p style={{ margin: "0 0 8px", fontWeight: 600, letterSpacing: "-.02em" }}>{PLATFORM_NAME}</p>
      <p
        role={error ? "alert" : "status"}
        style={{ margin: 0, color: error ? "#A93226" : "#42566B", maxWidth: 36 * 16 }}
      >
        {message}
      </p>
      {children ? (
        <p style={{ marginTop: 18, fontSize: 14 }}>
          {children}
        </p>
      ) : null}
    </div>
  );
}
