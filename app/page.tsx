"use client";
import Link from "next/link";
import MarketingShell from "@/app/_components/MarketingShell";
import AuditWidget from "@/app/_components/AuditWidget";
import MarketingCharts from "@/app/_components/MarketingCharts";
import MarketingProof from "@/app/_components/MarketingProof";
import { PLATFORM_NAME } from "@/lib/ui/tokens";

// Public front door and the top of the funnel.
//
// The hero leads with a free audit rather than a signup button on purpose: a
// visitor who has just seen real problems on their own site has a reason to
// create an account, where one who has only read a value proposition does not.
// Everything below the fold exists to answer the questions that audit raises —
// and to make clear this is an intelligence OS, not a content mill.

export default function Home() {
  return (
    <MarketingShell>
      <main id="main">
        <section className="mk-hero mk-hero-audit" aria-labelledby="mk-hero-title">
          <div className="mk-hero-inner">
            <div className="mk-hero-copy">
              <p className="mk-badge">
                <span className="mk-badge-dot" aria-hidden="true" />
                AI SEO operating system
              </p>
              <h1 id="mk-hero-title" className="mk-hero-title">
                Outrank competitors. Grow the business.
              </h1>
              <p className="mk-hero-support">
                {PLATFORM_NAME} is the intelligence layer behind your SEO: it maps rivals,
                finds the gaps that actually cost you customers, ranks the next moves by
                impact, then drafts and ships the work — on-page and off-page — after you
                approve. Content is one output. Competitive clarity is the product.
              </p>

              <AuditWidget />

              <ol className="mk-loop" aria-label="What the intelligence system does">
                <li>
                  <b>Compete</b>
                  <span>Benchmark rivals and SERP share</span>
                </li>
                <li>
                  <b>Diagnose</b>
                  <span>Technical, content, and authority debt</span>
                </li>
                <li>
                  <b>Prioritize</b>
                  <span>Moves scored by business impact</span>
                </li>
                <li>
                  <b>Execute &amp; prove</b>
                  <span>Ship approved work, attribute lift</span>
                </li>
              </ol>

              <p className="mk-hero-alt">
                <a href="#how">See the operating system</a> · <Link href="/pricing">View pricing</Link>
              </p>
            </div>
          </div>
        </section>

        <section id="how" className="mk-section" aria-labelledby="mk-how-title">
          <div className="mk-wrap">
            <div className="mk-section-head">
              <p className="mk-eyebrow">How it works</p>
              <h2 id="mk-how-title" className="mk-h2">An operating system — not a content checklist</h2>
              <p className="mk-lead">
                The system thinks in competition, demand, and outcomes. You stay in control of
                what goes live.
              </p>
            </div>
            <ol className="mk-steps">
              <li className="mk-step">
                <h3>Connect</h3>
                <p>Search Console and your site feed live ranking, query, and page data into the workspace.</p>
              </li>
              <li className="mk-step">
                <h3>Map rivals</h3>
                <p>Competitive context and SERP gaps show who is winning the customers you want — and why.</p>
              </li>
              <li className="mk-step">
                <h3>Score impact</h3>
                <p>Opportunities and fixes are ranked by likely effect on visibility, leads, and revenue — not vanity volume.</p>
              </li>
              <li className="mk-step">
                <h3>Approve &amp; ship</h3>
                <p>Drafts, technical changes, and off-page work wait for a human yes, then publish on your terms.</p>
              </li>
              <li className="mk-step">
                <h3>Attribute</h3>
                <p>See whether the work improved the business after go-live — outcome trails, not dashboard theater.</p>
              </li>
            </ol>
          </div>
        </section>

        <MarketingCharts />

        <section className="mk-section" aria-labelledby="mk-work-title" style={{ paddingTop: 0 }}>
          <div className="mk-wrap">
            <div className="mk-section-head">
              <p className="mk-eyebrow">What the system figures out</p>
              <h2 id="mk-work-title" className="mk-h2">Intelligence first. Execution second.</h2>
              <p className="mk-lead">
                Agents do not start by writing. They compare, score, and decide what is worth
                doing — then produce the work your team can approve.
              </p>
            </div>
            <ul className="mk-work">
              <li>
                <h3>Competitive gap analysis</h3>
                <p>
                  Sees which rival pages, topics, and SERP features are taking your demand —
                  and which gaps you can still close profitably.
                </p>
              </li>
              <li>
                <h3>Impact-ranked roadmap</h3>
                <p>
                  Turns raw issues into a sequenced plan: highest-ROI keywords, pages, and
                  technical fixes first so effort follows money, not noise.
                </p>
              </li>
              <li>
                <h3>Full-stack SEO execution</h3>
                <p>
                  Content and meta when needed — plus technical hygiene, authority targets,
                  and local presence work where it applies. Publishing is one stage of a
                  larger loop.
                </p>
              </li>
              <li>
                <h3>Outcome attribution</h3>
                <p>
                  Ties approved work back to ranking and business movement after publish, so
                  you know what to double down on — and what to stop.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <MarketingProof />

        <section className="mk-section mk-trust" aria-labelledby="mk-trust-title">
          <div className="mk-wrap">
            <div className="mk-section-head">
              <p className="mk-eyebrow">Control</p>
              <h2 id="mk-trust-title" className="mk-h2">Your brand stays yours</h2>
              <p className="mk-lead">
                Built for owners who need competitive firepower without surrendering the site
                to a black box.
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
            <h2 id="mk-final-title" className="mk-h2">Put competitive SEO intelligence on your side</h2>
            <p className="mk-lead">
              Start a trial, connect Search Console, and see the first impact-ranked moves for your market.
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
