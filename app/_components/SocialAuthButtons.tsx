"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { oauthRedirectTo, type SocialProvider } from "@/lib/authDestination";

/**
 * Social sign-in buttons for login + signup.
 * Providers must be enabled in Supabase Auth (Google / GitHub / Apple).
 * Google here is Supabase Auth login — separate from Business Profile connect.
 */

const PROVIDERS: { id: SocialProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "apple", label: "Apple" },
];

export default function SocialAuthButtons({
  next = "/onboarding",
  site,
  onError,
  disabled,
  variant = "login",
}: {
  next?: string;
  site?: string | null;
  onError: (message: string) => void;
  disabled?: boolean;
  variant?: "login" | "signup";
}) {
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  async function start(provider: SocialProvider) {
    onError("");
    setBusy(provider);
    try {
      const origin = window.location.origin;
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: oauthRedirectTo(origin, { next, site: site || undefined }),
          skipBrowserRedirect: false,
        },
      });
      if (error) {
        onError(
          error.message.includes("provider is not enabled")
            ? `${provider[0].toUpperCase()}${provider.slice(1)} sign-in isn't enabled yet. Use email for now, or ask the platform owner to enable it in Supabase Auth.`
            : error.message
        );
        setBusy(null);
      }
      // On success the browser navigates away to the provider.
    } catch (e) {
      onError("Connection error: " + String(e));
      setBusy(null);
    }
  }

  return (
    <div className={variant === "signup" ? "mk-social" : "lg-social"}>
      <div className={variant === "signup" ? "mk-social-sep" : "lg-social-sep"} aria-hidden="true">
        <span>or continue with</span>
      </div>
      <div className={variant === "signup" ? "mk-social-grid" : "lg-social-grid"}>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={variant === "signup" ? "mk-social-btn" : "lg-social-btn"}
            onClick={() => start(p.id)}
            disabled={disabled || !!busy}
            data-busy={busy === p.id || undefined}
            aria-label={`Continue with ${p.label}`}
          >
            <ProviderIcon id={p.id} />
            <span>{busy === p.id ? "Redirecting…" : p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProviderIcon({ id }: { id: SocialProvider }) {
  if (id === "google") {
    return (
      <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
      </svg>
    );
  }
  if (id === "github") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M12.64 8.55c-.02-2.05 1.67-3.04 1.75-3.09-0.95-1.39-2.43-1.58-2.96-1.6-1.26-.13-2.46.74-3.1.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.65.8-3.36 2.04-1.43 2.49-.37 6.17 1.03 8.19.69 1 1.5 2.11 2.57 2.07 1.03-.04 1.42-.67 2.67-.67 1.24 0 1.6.67 2.68.65 1.11-.02 1.81-1.01 2.49-2.01.78-1.14 1.1-2.25 1.12-2.31-.02-.01-2.15-.82-2.17-3.26l-.04-.05ZM10.7 2.68c.57-.69.95-1.65.85-2.61-.82.03-1.81.55-2.4 1.24-.53.61-.99 1.58-.87 2.51.92.07 1.86-.47 2.42-1.14Z" />
    </svg>
  );
}
