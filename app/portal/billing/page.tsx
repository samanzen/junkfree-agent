"use client";
import { useEffect, useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import { authedFetch } from "@/lib/authedFetch";
import { useToast } from "@/app/_components/Notify";
import PageHeader from "../_components/PageHeader";
import ConnectCard from "../_components/ConnectCard";
import EmptyState from "../_components/EmptyState";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger } from "../_components/motion";
import { IconBilling } from "../icons";
import { TRIAL_DAYS } from "@/lib/ui/tokens";

export default function BillingPage() {
  const { brand } = usePortalAuth();
  const toast = useToast();
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authedFetch("/api/portal/billing/checkout")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setConfigured(Boolean(d.configured));
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!brand) return null;

  async function startCheckout(plan: "founding" | "growth") {
    setBusy(plan);
    try {
      const res = await authedFetch("/api/portal/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brand!.id, plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        toast.error(data.error || "Checkout isn't available", "Try again or contact support.");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Checkout isn't available", "Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Billing"
        title="Plan & billing"
        sub={
          configured
            ? "Manage your subscription and invoices."
            : `Your ${TRIAL_DAYS}-day trial and plan options.`
        }
      />

      <Panel>
        <PanelHead title="Your plan" />
        {configured ? (
          <div className="p-stack" style={{ gap: 12 }}>
            <p className="p-muted" style={{ margin: 0 }}>
              Self-serve checkout is available. Choose a plan to continue after your trial.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                className="p-btn primary"
                disabled={!!busy}
                data-busy={busy === "founding" || undefined}
                onClick={() => startCheckout("founding")}
              >
                <span>{busy === "founding" ? "Opening…" : "Founding plan"}</span>
              </button>
              <button
                className="p-btn ghost"
                disabled={!!busy}
                data-busy={busy === "growth" || undefined}
                onClick={() => startCheckout("growth")}
              >
                <span>{busy === "growth" ? "Opening…" : "Growth plan"}</span>
              </button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<IconBilling size={26} />}
            title="Trial active — self-serve checkout coming online"
            sub={`${brand.name} can use the platform on trial. When Stripe keys are configured, plan upgrades unlock here automatically.`}
          />
        )}
      </Panel>

      {!configured && (
        <Stagger className="p-subgrid">
          <ConnectCard
            icon={<IconBilling size={17} />}
            title="Subscription management"
            desc="View your current plan, change tier, or pause your subscription without needing to email anyone."
            unlocks={["View or change your plan any time", "No email back-and-forth required"]}
            requirement="Add Stripe keys to enable self-serve checkout. Until then, your account manager can help with billing."
          />
          <ConnectCard
            title="Invoices"
            desc="Download every past invoice as a PDF, with your business details already filled in for your accountant."
            unlocks={["Download every invoice as a PDF", "Business details already filled in"]}
            requirement="Invoices appear here once Stripe Billing is connected."
          />
          <ConnectCard
            title="Payment methods"
            desc="Add or update the card on file, and set a backup payment method so service is never interrupted."
            unlocks={["Update the card on file", "Add a backup so service never lapses"]}
            requirement="Card vaulting requires Stripe Customer Portal — enabled with the same keys."
          />
          <ConnectCard
            title="Usage"
            desc="See exactly what your plan covers this month — content pieces produced, keywords tracked, locations monitored and reports generated."
            unlocks={["Content produced and keywords tracked", "Exactly what your plan covers this month"]}
            requirement="Usage meters attach to plan quotas once billing plans are live."
          />
        </Stagger>
      )}
    </div>
  );
}
