"use client";
import Link from "next/link";
import MarketingShell, { TALK_TO_US_HREF } from "@/app/_components/MarketingShell";
import { PLATFORM_NAME } from "@/lib/ui/tokens";

// Honest pricing surface. Self-serve Stripe billing is not live yet — trial
// CTAs go to /signup; Managed / sales conversations use mailto until they are.

export default function PricingPage() {
  return (
    <MarketingShell active="pricing">
      <main id="main" className="mk-section">
        <div className="mk-wrap">
          <div className="mk-section-head">
            <p className="mk-eyebrow">Pricing</p>
            <h1 className="mk-h2" style={{ maxWidth: "16ch" }}>
              Simple plans for {PLATFORM_NAME}
            </h1>
            <p className="mk-lead">
              Start with a trial while self-serve billing comes online. No surprise auto-charges today.
            </p>
          </div>

          <div className="mk-price-grid">
            <article className="mk-price is-featured">
              <h2>Founding</h2>
              <p className="mk-price-amt">Early access <span>/ brand</span></p>
              <p>For operators who want the AI workflow now and help shape what ships next.</p>
              <ul>
                <li>One brand workspace</li>
                <li>Search Console + WordPress connect</li>
                <li>Approval queue and audit trail</li>
                <li>Founding pricing locked when billing goes live</li>
              </ul>
              <Link href="/signup" className="mk-btn mk-btn-primary">Start trial</Link>
            </article>

            <article className="mk-price">
              <h2>Growth</h2>
              <p className="mk-price-amt">Standard <span>/ brand</span></p>
              <p>For teams that want ongoing agent work across content, technical, and measurement.</p>
              <ul>
                <li>Everything in Founding</li>
                <li>Higher run capacity as rate limits allow</li>
                <li>Priority when self-serve plans launch</li>
                <li>Email support during trial</li>
              </ul>
              <Link href="/signup" className="mk-btn mk-btn-primary">Start trial</Link>
            </article>

            <article className="mk-price">
              <h2>Managed</h2>
              <p className="mk-price-amt">Custom</p>
              <p>For brands that want an operator in the loop — strategy plus the platform.</p>
              <ul>
                <li>Dedicated onboarding</li>
                <li>Human review alongside agents</li>
                <li>Multi-brand / agency setups</li>
                <li>Billing handled with your account team</li>
              </ul>
              <a href={TALK_TO_US_HREF} className="mk-btn mk-btn-secondary">Talk to us</a>
            </article>
          </div>

          <p className="mk-price-note">
            Card checkout is not wired yet. Starting a trial creates your account and brand workspace;
            paid self-serve plans will attach later. Shopify publishing is not available.
          </p>
        </div>
      </main>
    </MarketingShell>
  );
}
