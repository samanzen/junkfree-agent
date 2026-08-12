"use client";
import Link from "next/link";
import MarketingShell from "@/app/_components/MarketingShell";
import { PLATFORM_NAME, PLATFORM_DESCRIPTION } from "@/lib/ui/tokens";

// Public front door. Previously redirected straight to /dashboard — that made
// the product invisible to anyone who was not already an operator. This page
// is the marketing surface; signed-in users still reach the apps via Login.

export default function Home() {
  return (
    <MarketingShell>
      <main id="main">
        <section className="mk-hero" aria-labelledby="mk-hero-brand">
          <div className="mk-hero-inner">
            <div className="mk-hero-copy">
              <h1 id="mk-hero-brand" className="mk-hero-brand">{PLATFORM_NAME}</h1>
              <p className="mk-hero-headline">
                An AI SEO team that executes — with you in control.
              </p>
              <p className="mk-hero-support">{PLATFORM_DESCRIPTION}</p>
              <div className="mk-hero-cta">
                <Link href="/signup" className="mk-btn mk-btn-primary">Start free trial</Link>
                <a href="#how" className="mk-btn mk-btn-secondary">See how it works</a>
              </div>
            </div>

            <div className="mk-viz" aria-hidden="true">
              <div className="mk-viz-plane">
                <div className="mk-viz-rail">
                  <span /><span /><span /><span />
                </div>
                <div className="mk-viz-main">
                  <div className="mk-viz-bar" />
                  <div className="mk-viz-rows">
                    <div className="mk-viz-row"><i /><i /><i /></div>
                    <div className="mk-viz-row"><i /><i /><i /></div>
                    <div className="mk-viz-row"><i /><i /><i /></div>
                    <div className="mk-viz-row"><i /><i /><i /></div>
                  </div>
                </div>
                <div className="mk-viz-pulse" />
              </div>
              <div className="mk-viz-tag">Approve → publish</div>
            </div>
          </div>
        </section>

        <section id="how" className="mk-section" aria-labelledby="mk-how-title">
          <div className="mk-wrap">
            <div className="mk-section-head">
              <p className="mk-eyebrow">How it works</p>
              <h2 id="mk-how-title" className="mk-h2">From connect to measured results</h2>
              <p className="mk-lead">
                Five steps. The system proposes; you approve what goes live.
              </p>
            </div>
            <ol className="mk-steps">
              <li className="mk-step">
                <h3>Connect</h3>
                <p>Link Search Console and your site so the agents work from real data.</p>
              </li>
              <li className="mk-step">
                <h3>Analyze</h3>
                <p>Rankings, gaps, and technical issues are scored against your business model.</p>
              </li>
              <li className="mk-step">
                <h3>Approve</h3>
                <p>Drafts and changes wait for a human yes — nothing ships silently.</p>
              </li>
              <li className="mk-step">
                <h3>Execute</h3>
                <p>Approved work publishes to WordPress (or a webhook) on your terms.</p>
              </li>
              <li className="mk-step">
                <h3>Measure</h3>
                <p>See what moved after publish — not vanity dashboards, outcome trails.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="mk-section" aria-labelledby="mk-work-title" style={{ paddingTop: 0 }}>
          <div className="mk-wrap">
            <div className="mk-section-head">
              <p className="mk-eyebrow">What the AI does</p>
              <h2 id="mk-work-title" className="mk-h2">Work performed, not another tool list</h2>
              <p className="mk-lead">
                Agents research, draft, and queue changes so your team spends time deciding — not grinding.
              </p>
            </div>
            <ul className="mk-work">
              <li>
                <h3>Finds the next worthwhile move</h3>
                <p>Surfaces keyword and page opportunities from your Search Console data and competitive context.</p>
              </li>
              <li>
                <h3>Writes drafts you can ship</h3>
                <p>Produces page and post drafts with titles and meta ready for review before anything is published.</p>
              </li>
              <li>
                <h3>Keeps technical hygiene moving</h3>
                <p>Flags fixable issues and prepares low-risk changes so technical debt does not pile up unnoticed.</p>
              </li>
              <li>
                <h3>Supports local presence where it applies</h3>
                <p>For local businesses, drafts location-minded content and citation targets. Google Business automation is still partial.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="mk-section mk-trust" aria-labelledby="mk-trust-title">
          <div className="mk-wrap">
            <div className="mk-section-head">
              <p className="mk-eyebrow">Trust</p>
              <h2 id="mk-trust-title" className="mk-h2">Your brand stays yours</h2>
              <p className="mk-lead">
                Built for agencies and operators who need control, not black-box publishing.
              </p>
            </div>
            <div className="mk-trust-grid">
              <div>
                <h3>Human approvals</h3>
                <p>Content and site changes wait in a queue until someone on your team says yes.</p>
              </div>
              <div>
                <h3>Auditable history</h3>
                <p>What ran, what was approved, and what published is recorded so you can explain every change.</p>
              </div>
              <div>
                <h3>Tenant isolation</h3>
                <p>Each business is its own workspace — data and credentials stay scoped to that brand, not mixed across customers.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mk-section" aria-labelledby="mk-integ-title">
          <div className="mk-wrap">
            <div className="mk-section-head">
              <p className="mk-eyebrow">Integrations</p>
              <h2 id="mk-integ-title" className="mk-h2">Honest about what is live</h2>
              <p className="mk-lead">
                We only claim connections that customers can actually use today.
              </p>
            </div>
            <ul className="mk-integ">
              <li>
                <strong>Google Search Console</strong>
                <span className="mk-status">Available</span>
                <p>OAuth connect so rankings and opportunities come from your property.</p>
              </li>
              <li>
                <strong>WordPress</strong>
                <span className="mk-status">Available</span>
                <p>Publish approved pages and posts with application passwords — live site execution, not a mock.</p>
              </li>
              <li>
                <strong>Google Business Profile</strong>
                <span className="mk-status is-partial">Partial</span>
                <p>Local workflows and drafts exist; full profile automation is still incomplete.</p>
              </li>
              <li>
                <strong>Shopify</strong>
                <span className="mk-status is-soon">Not available yet</span>
                <p>No Shopify adapter ships today. Ecommerce brands can still use analysis and WordPress/webhook publishing where applicable.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="mk-section mk-final" aria-labelledby="mk-final-title">
          <div className="mk-wrap">
            <p className="mk-eyebrow">Get started</p>
            <h2 id="mk-final-title" className="mk-h2">Put an AI SEO team on your site</h2>
            <p className="mk-lead">
              Start a trial, connect Search Console, and approve the first piece of work.
            </p>
            <div className="mk-final-cta">
              <Link href="/signup" className="mk-btn mk-btn-primary">Start free trial</Link>
              <Link href="/pricing" className="mk-btn mk-btn-secondary">View pricing</Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
