"use client";
import Link from "next/link";
import MarketingShell, { TALK_TO_US_HREF } from "@/app/_components/MarketingShell";
import { PLATFORM_NAME, TRIAL_DAYS } from "@/lib/ui/tokens";
import { PLAN_CAPACITY, type PlanKey } from "@/lib/capabilities";

// Pricing is sold as execution capacity — how much the AI OS can run —
// not as Semrush-style toolkit SKUs. Stripe amounts stay in env; labels here
// describe the capacity package each plan unlocks.

const ORDER: PlanKey[] = ["founding", "growth", "managed"];

function bullets(plan: PlanKey): string[] {
  const c = PLAN_CAPACITY[plan];
  const q = c.quotas;
  return [
    `Up to ${q.agent_runs_per_day} full agent runs / day`,
    `Track ${q.tracked_keywords.toLocaleString()} keywords`,
    `${q.ai_prompts} AI visibility prompts`,
    `${q.competitors} competitors in gap analysis`,
    `${q.images_per_day} AI images / day`,
    "Approve → publish to WordPress / Shopify",
    "Review reply automation + GBP posts",
    "Conversion signals when Analytics is connected",
  ];
}

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
              const plan = PLAN_CAPACITY[key];
              const featured = key === "founding";
              return (
                <article key={key} className={`mk-price${featured ? " is-featured" : ""}`}>
                  <h2>{plan.label}</h2>
                  <p className="mk-price-amt">
                    {plan.priceLabel} <span>/ brand</span>
                  </p>
                  <p>{plan.tagline}</p>
                  <ul>
                    {bullets(key).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                    {key === "founding" && (
                      <li>{TRIAL_DAYS}-day trial · founding rate locked when billing goes live</li>
                    )}
                    {key === "growth" && <li>Higher API throughput for ongoing agent work</li>}
                    {key === "managed" && <li>Human operators alongside the platform</li>}
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
            {PLAN_CAPACITY.founding.priceHint}.
          </p>
        </div>
      </main>
    </MarketingShell>
  );
}
