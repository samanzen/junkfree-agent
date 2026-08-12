"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { authedFetch } from "@/lib/authedFetch";
import MarketingShell from "@/app/_components/MarketingShell";
import Field from "@/app/_components/Field";
import { PLATFORM_NAME } from "@/lib/ui/tokens";
import type { BusinessModel } from "@/lib/brands";

const MODELS: { value: BusinessModel; label: string }[] = [
  { value: "local_service", label: "Local service" },
  { value: "ecommerce", label: "Ecommerce" },
  { value: "saas", label: "SaaS" },
  { value: "national_brand", label: "National brand" },
  { value: "content_publisher", label: "Content publisher" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [businessModel, setBusinessModel] = useState<BusinessModel>("local_service");
  const [serviceArea, setServiceArea] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabaseBrowser().auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      // If they already finished onboarding, skip the form.
      try {
        const me = await authedFetch("/api/me");
        if (me.ok) {
          const body = await me.json();
          if (body.role === "admin") {
            router.replace("/dashboard");
            return;
          }
          if (body.brand_id) {
            // Resume activation rather than dumping onto a dense dashboard.
            router.replace("/portal/setup");
            return;
          }
        }
      } catch {
        // Fall through to the form — submit will surface auth errors.
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submit() {
    setErr("");
    if (!name.trim()) {
      setErr("Business name is required.");
      return;
    }
    if (!siteUrl.trim()) {
      setErr("Website URL is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await authedFetch("/api/portal/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          site_url: siteUrl.trim(),
          business_model: businessModel,
          service_area: serviceArea.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.error || `Could not finish setup (${res.status}).`);
        setBusy(false);
        return;
      }
      router.push("/portal/setup");
    } catch (e) {
      setErr("Connection error: " + String(e));
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <MarketingShell>
        <main id="main" className="mk-auth">
          <p className="mk-auth-sub" style={{ textAlign: "center" }}>
            Loading…
          </p>
        </main>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <main id="main" className="mk-auth">
        <div className="mk-auth-card" style={{ maxWidth: 480 }}>
          <h1>Set up your brand</h1>
          <p className="mk-auth-sub">
            Tell {PLATFORM_NAME} which business to run SEO for. Next you&apos;ll connect Search Console and prove the first publish loop.
          </p>
          <div className="mk-auth-fields">
            <Field
              label="Business name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (err) setErr("");
              }}
              disabled={busy}
              autoComplete="organization"
            />
            <Field
              label="Website URL"
              type="url"
              required
              value={siteUrl}
              onChange={(e) => {
                setSiteUrl(e.target.value);
                if (err) setErr("");
              }}
              helper="Must start with https://"
              placeholder="https://example.com"
              disabled={busy}
              autoComplete="url"
            />
            <Field
              as="select"
              label="Business model"
              required
              value={businessModel}
              onChange={(e) => setBusinessModel(e.target.value as BusinessModel)}
              disabled={busy}
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Field>
            <Field
              label="Service area"
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
              helper="Optional — city, region, or “national”."
              disabled={busy}
            />
          </div>
          {err && (
            <div className="mk-auth-err" role="alert">
              {err}
            </div>
          )}
          <button
            type="button"
            className="mk-btn mk-btn-primary"
            style={{ width: "100%" }}
            onClick={submit}
            disabled={busy}
            data-busy={busy || undefined}
            aria-live="polite"
          >
            <span>{busy ? "Creating workspace…" : "Continue setup"}</span>
          </button>
        </div>
      </main>
    </MarketingShell>
  );
}
