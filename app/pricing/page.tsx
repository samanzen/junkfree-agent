"use client";
import Link from "next/link";
import MarketingShell, { TALK_TO_US_HREF } from "@/app/_components/MarketingShell";
import { PLATFORM_NAME, TRIAL_DAYS } from "@/lib/ui/tokens";

// Pricing is sold as execution capacity — how much the AI OS can run —
// not as Semrush-style toolkit SKUs. Stripe amounts stay in env; labels here
// describe the capacity package each plan unlocks. Kept local so marketing
// can ship without requiring the full billing entitlement system.

type PlanKey = "founding" | "growth" | "managed";

const PLANS: Record<
  PlanKey,
  {
    label: string;
    tagline: string;
    priceLabel: string;
    priceHint: string;
    bullets: string[];
  }
> = {
  founding: {
    label: "Founding",
    tagline: "One brand. Full AI loop. Approve and ship.",
    priceLabel: "Early access",
    priceHint: "Per brand · locked founding rate when billing is live",
    bullets: [
      "Up to 2 full agent runs / day",
      "Track 500 keywords",
      "25 AI visibility prompts",
      "5 competitors in gap analysis",
      "2 AI images / day",
      "Approve → publish to WordPress / Shopify",
      "Review reply automation + GBP posts",
      "Conversion signals when Analytics is connected",
    ],
  },
  growth: {
    label: "Growth",
    tagline: "More runs, more keywords, deeper AI visibility.",
    priceLabel: "Scale",
    priceHint: "Higher throughput for ongoing agent work",
    bullets: [
      "Up to 8 full agent runs / day",
      "Track 2,000 keywords",
      "100 AI visibility prompts",
      "15 competitors in gap analysis",
      "10 AI images / day",
      "Approve → publish to WordPress / Shopify",
      "Review reply automation + GBP posts",
      "Conversion signals when Analytics is connected",
      "Higher API throughput for ongoing agent work",
    ],
  },
  managed: {
    label: "Managed",
    tagline: "Human operators alongside the platform.",
    priceLabel: "Custom",
    priceHint: "Sales-led · operators + platform capacity",
    bullets: [
      "Custom agent-run capacity",
      "Custom keyword and prompt limits",
      "Approve → publish to WordPress / Shopify",
      "Review reply automation + GBP posts",
      "Conversion signals when Analytics is connected",
      "Human operators alongside the platform",
    ],
  },
};

const ORDER: PlanKey[] = ["founding", "growth", "managed"];

export default function PricingPage() {
  return (
    <MarketingShell active="pricing">
      <main id="main" className="mk-section">
        <div className="mk-wrap">
          <div className="mk-section-head">
            <p className="mk-eyebrow">Pricing</p>
            <h1 className="mk-h2" style={{ maxWidth: "18ch" }}>
              Pay for execution capacity — not toolkits
            </h1>
            <p className="mk-lead">
              Semrush sells research dashboards by the toolkit. {PLATFORM_NAME} sells an AI SEO
              operating system: analyze, generate, approve, publish, and learn — with capacity that
              scales as your brand grows.
            </p>
          </div>

          <div className="mk-price-grid">
            {ORDER.map((key) => {
              const plan = PLANS[key];
              const featured = key === "founding";
              return (
                <article key={key} className={`mk-price${featured ? " is-featured" : ""}`}>
                  <h2>{plan.label}</h2>
                  <p className="mk-price-amt">
                    {plan.priceLabel} <span>/ brand</span>
                  </p>
                  <p>{plan.tagline}</p>
                  <ul>
                    {plan.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                    {key === "founding" && (
                      <li>{TRIAL_DAYS}-day trial · founding rate locked when billing goes live</li>
                    )}
                  </ul>
                  {key === "managed" ? (
                    <a href={TALK_TO_US_HREF} className="mk-btn mk-btn-secondary">
                      Talk to us
                    </a>
                  ) : (
                    <Link href="/signup" className="mk-btn mk-btn-primary">
                      Start trial
                    </Link>
                  )}
                </article>
              );
            })}
          </div>

          <div className="mk-price-compare">
            <h2 className="mk-h2" style={{ fontSize: "1.35rem", maxWidth: "28ch" }}>
              Why this beats toolkit pricing
            </h2>
            <ul className="mk-check-list">
              <li>
                <b>We ship work.</b> Research tools show the list. We draft content, GBP posts,
                review replies, and publish after you approve.
              </li>
              <li>
                <b>Capacity is the product.</b> More keywords, prompts, runs, and competitors as
                you grow — one OS, not five add-on SKUs.
              </li>
              <li>
                <b>AI visibility is included.</b> Prompt tracking for assistant-style discovery is
                part of the loop, not a $99/domain bolt-on.
              </li>
            </ul>
          </div>

          <p className="mk-price-note">
            Start a trial to create your account and brand workspace. Card checkout unlocks when
            Stripe is configured — until then there are no surprise auto-charges.{" "}
            {PLANS.founding.priceHint}.
          </p>
        </div>
      </main>
    </MarketingShell>
  );
}
