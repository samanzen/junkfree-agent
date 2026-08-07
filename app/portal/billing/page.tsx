"use client";
import { usePortalAuth } from "@/lib/portalAuth";
import PageHeader from "../_components/PageHeader";
import ConnectCard from "../_components/ConnectCard";
import EmptyState from "../_components/EmptyState";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger } from "../_components/motion";
import { IconBilling } from "../icons";

export default function BillingPage() {
  const { brand } = usePortalAuth();
  if (!brand) return null;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Billing"
        title="Plan & billing"
        sub="Your subscription, invoices and usage."
      />

      <Panel>
        <PanelHead title="Your plan" />
        <EmptyState
          icon={<IconBilling size={26} />}
          title="Billing is handled directly by your account manager"
          sub={`${brand.name} is managed as a serviced account, so there's no self-serve subscription to configure here. Your account manager can answer any billing question.`}
        />
      </Panel>

      <Stagger className="p-subgrid">
        <ConnectCard
          icon={<IconBilling size={17} />}
          title="Subscription management"
          desc="View your current plan, change tier, or pause your subscription without needing to email anyone."
          unlocks={["View or change your plan any time", "No email back-and-forth required"]}
          requirement="Billing runs through your account manager today. Self-serve plan changes need a payment provider connected to the portal, which isn't set up yet."
        />
        <ConnectCard
          title="Invoices"
          desc="Download every past invoice as a PDF, with your business details already filled in for your accountant."
          unlocks={["Download every invoice as a PDF", "Business details already filled in"]}
          requirement="Invoices are issued by your account manager. Downloadable PDFs need billing records stored in the portal, which they aren't yet."
        />
        <ConnectCard
          title="Payment methods"
          desc="Add or update the card on file, and set a backup payment method so service is never interrupted."
          unlocks={["Update the card on file", "Add a backup so service never lapses"]}
          requirement="Payment details are held by your account manager. Storing cards here needs a payment provider integration, which doesn't exist yet."
        />
        <ConnectCard
          title="Usage"
          desc="See exactly what your plan covers this month — content pieces produced, keywords tracked, locations monitored and reports generated."
          unlocks={["Content produced and keywords tracked", "Exactly what your plan covers this month"]}
          requirement="Needs per-plan quotas to measure against. Plans aren't defined in the platform yet, so there is no allowance to report against."
        />
      </Stagger>
    </div>
  );
}
