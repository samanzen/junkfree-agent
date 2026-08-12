"use client";
import Link from "next/link";
import MarketingShell from "@/app/_components/MarketingShell";
import AuditWidget from "@/app/_components/AuditWidget";
import { PLATFORM_NAME } from "@/lib/ui/tokens";

// Public front door and the top of the funnel.
//
// The hero leads with a free audit rather than a signup button on purpose: a
// visitor who has just seen real problems on their own site has a reason to
// create an account, where one who has only read a value proposition does not.
// Everything below the fold exists to answer the questions that audit raises.

export default function Home() {
  return (
    <MarketingShell>
      <main id="main">
        <section className="mk-hero mk-hero-audit" aria-labelledby="mk-hero-title">
          <div className="mk-hero-inner">
            <div className="mk-hero-copy">
              {/* Category first. A visitor should know WHAT this is before they
                  read a headline, so the badge states it plainly rather than
                  making them infer a product from a benefit line. */}
              <p className="mk-badge">
                <span className="mk-badge-dot" aria-hidden="true" />
                Automated SEO platform
              </p>
              <h1 id="mk-hero-title" className="mk-hero-title">
                SEO that runs itself
              </h1>
              <p className="mk-hero-support">
                {PLATFORM_NAME} finds what is holding your rankings back, writes the fixes,
                publishes them once you approve, and measures what actually moved — on-page
                and off-page, for any business at any size.
              </p>

              <AuditWidget />

              <ol className="mk-loop" aria-label="What the platform does on its own">
                <li>
                  <b>Finds</b>
                  <span>issues and opportunities</span>
                </li>
                <li>
                  <b>Writes</b>
                  <span>the fixes and content</span>
                </li>
                <li>
                  <b>Publishes</b>
                  <span>once you approve</span>
                </li>
                <li>
                  <b>Measures</b>
                  <span>what actually moved</span>
                </li>
              </ol>

              <p className="mk-hero-alt">
                <a href="#how">See how it works</a> · <Link href="/pricing">View pricing</Link>
              </p>
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
                Built for business owners who need control, not black-box publishing.
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
