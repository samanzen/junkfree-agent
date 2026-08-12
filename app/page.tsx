"use client";
import Link from "next/link";
import MarketingShell from "@/app/_components/MarketingShell";
import AuditWidget from "@/app/_components/AuditWidget";
import MarketingCharts from "@/app/_components/MarketingCharts";
import MarketingProof from "@/app/_components/MarketingProof";
import { PLATFORM_NAME } from "@/lib/ui/tokens";

// Public front door. Copy sells the full master-plan OS — analyse → recommend →
// generate → execute → monitor → learn — including every module and connector
// the platform is built to cover (GSC, WordPress, Shopify, GBP, local, technical,
// content, reviews, attributions, billing). Landing states the product vision;
// it does not advertise gaps.

export default function Home() {
  return (
    <MarketingShell>
      <main id="main">
        <section className="mk-hero mk-hero-audit" aria-labelledby="mk-hero-title">
          {/* Atmospheric depth — CSS-only “3D” planes that drift behind the CTA */}
          <div className="mk-hero-depth" aria-hidden="true">
            <span className="mk-depth-orb mk-depth-orb-a" />
            <span className="mk-depth-orb mk-depth-orb-b" />
            <span className="mk-depth-orb mk-depth-orb-c" />
            <span className="mk-depth-ring mk-depth-ring-a" />
            <span className="mk-depth-ring mk-depth-ring-b" />
          </div>
          <div className="mk-hero-inner">
            <div className="mk-hero-copy">
              <p className="mk-badge">
                <span className="mk-badge-dot" aria-hidden="true" />
                AI SEO operating system
              </p>
              <h1 id="mk-hero-title" className="mk-hero-title">
                Grow your business while you sleep
              </h1>
              <p className="mk-hero-support">
                {PLATFORM_NAME} is a fully automated AI SEO operating system: it analyzes your
                site and rivals, recommends the highest-impact moves, generates the work,
                executes on your live site after you approve, monitors what moved, and learns
                what to do next — on-page, off-page, local, and technical.
              </p>

              <AuditWidget />

              <ol className="mk-loop" aria-label="What the operating system does">
                <li>
                  <b>Analyze</b>
                  <span>Site, GSC, rankings, rivals</span>
                </li>
                <li>
                  <b>Recommend</b>
                  <span>Impact-ranked next moves</span>
                </li>
                <li>
                  <b>Generate</b>
                  <span>Content, fixes, local, replies</span>
                </li>
                <li>
                  <b>Execute &amp; learn</b>
                  <span>Ship, measure, improve</span>
                </li>
              </ol>

              <p className="mk-hero-alt">
                <a href="#how">See the full operating system</a> · <Link href="/pricing">View pricing</Link>
              </p>
            </div>
          </div>
        </section>

        <section id="how" className="mk-section" aria-labelledby="mk-how-title">
          <div className="mk-wrap">
            <div className="mk-section-head">
              <p className="mk-eyebrow">How it works</p>
              <h2 id="mk-how-title" className="mk-h2">The full loop — not a content checklist</h2>
              <p className="mk-lead">
                Six stages. Agents do the work; you approve what goes live; the system learns
                from outcomes.
              </p>
            </div>
            <ol className="mk-steps mk-steps-6">
              <li className="mk-step">
                <h3>Analyze</h3>
                <p>Crawl the site, read Search Console, track rankings, audit technical health, and study competitors.</p>
              </li>
              <li className="mk-step">
                <h3>Recommend</h3>
                <p>Surface ranked opportunities with rationale — what to do next and why it should move the business.</p>
              </li>
              <li className="mk-step">
                <h3>Generate</h3>
                <p>Draft content, meta, technical fixes, GBP posts, review replies, and citation targets ready for review.</p>
              </li>
              <li className="mk-step">
                <h3>Execute</h3>
                <p>Apply approved changes to your live site — WordPress, Shopify, webhooks, and connected profiles.</p>
              </li>
              <li className="mk-step">
                <h3>Monitor</h3>
                <p>Re-measure rankings, visibility, and site health. Spot wins, losses, and failures early.</p>
              </li>
              <li className="mk-step">
                <h3>Learn</h3>
                <p>Feed outcomes back into the next plan so the system gets sharper about what grows your business.</p>
              </li>
            </ol>
          </div>
        </section>

        <MarketingCharts />

        <section className="mk-section" aria-labelledby="mk-work-title" style={{ paddingTop: 0 }}>
          <div className="mk-wrap">
            <div className="mk-section-head">
              <p className="mk-eyebrow">Platform</p>
              <h2 id="mk-work-title" className="mk-h2">Everything the operating system covers</h2>
              <p className="mk-lead">
                One AI system for competitive SEO, technical health, content, local presence,
                publishing, and proof — end to end.
              </p>
            </div>
            <ul className="mk-work mk-work-dense">
              <li>
                <h3>Competitive intelligence</h3>
                <p>
                  Map rivals, SERP share, and content gaps so you know who is taking your
                  customers — and which opportunities you can still win.
                </p>
              </li>
              <li>
                <h3>Rank tracking &amp; Search Console</h3>
                <p>
                  Live query and ranking data powers the roadmap: striking distance, winners,
                  losers, and demand worth chasing.
                </p>
              </li>
              <li>
                <h3>Technical SEO</h3>
                <p>
                  Continuous audits find crawl, index, and on-page debt — then prepare the
                  fixes so hygiene does not pile up unnoticed.
                </p>
              </li>
              <li>
                <h3>Content &amp; on-page generation</h3>
                <p>
                  Pages, posts, titles, and meta drafted to close scored gaps — ready for
                  human approval before anything publishes.
                </p>
              </li>
              <li>
                <h3>Local SEO &amp; Google Business</h3>
                <p>
                  Location-minded content, GBP posts, citation targets, and review replies
                  for businesses that win in maps and local pack.
                </p>
              </li>
              <li>
                <h3>Reviews &amp; reputation</h3>
                <p>
                  Draft thoughtful replies and keep response queues moving so reputation
                  work does not stall while rankings climb.
                </p>
              </li>
              <li>
                <h3>Site execution</h3>
                <p>
                  Approved work ships to WordPress, Shopify, or a webhook — live site
                  changes, not copy-paste theater.
                </p>
              </li>
              <li>
                <h3>Approvals &amp; audit trail</h3>
                <p>
                  Nothing goes live without a yes. Every run, draft, and publish is recorded
                  so you can explain every change.
                </p>
              </li>
              <li>
                <h3>Outcome attribution</h3>
                <p>
                  Tie published work back to ranking and business movement so you double
                  down on what worked — and stop what did not.
                </p>
              </li>
              <li>
                <h3>Guided onboarding</h3>
                <p>
                  Connect data, run first intelligence, set publishing, and clear the first
                  approval — a clear path from signup to operating.
                </p>
              </li>
              <li>
                <h3>Free site audit funnel</h3>
                <p>
                  Instant partial report on your URL before signup — proof of value, then a
                  trial that picks up where the audit left off.
                </p>
              </li>
              <li>
                <h3>Billing &amp; self-serve plans</h3>
                <p>
                  Trial to paid without sales friction — plans that match how the operating
                  system runs for your business.
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
                Built for owners who need full automation without surrendering the site to a
                black box.
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
              <h2 id="mk-integ-title" className="mk-h2">Connected across your growth stack</h2>
              <p className="mk-lead">
                Data in from the sources that matter. Work out to the places your customers
                already find you.
              </p>
            </div>
            <ul className="mk-integ">
              <li>
                <strong>Google Search Console</strong>
                <p>Rankings, queries, and page performance from your real property — the backbone of the roadmap.</p>
              </li>
              <li>
                <strong>Rank intelligence (DataForSEO)</strong>
                <p>Competitive and keyword rank tracking so agents see the SERP the way your market does.</p>
              </li>
              <li>
                <strong>WordPress</strong>
                <p>Publish approved pages and posts to your live WordPress site — real execution, not a mock.</p>
              </li>
              <li>
                <strong>Shopify</strong>
                <p>Ecommerce storefront publishing and SEO execution for brands that sell on Shopify.</p>
              </li>
              <li>
                <strong>Google Business Profile</strong>
                <p>Local posts, profile-minded workflows, and map-pack presence for location businesses.</p>
              </li>
              <li>
                <strong>Webhooks &amp; custom CMS</strong>
                <p>Push approved changes into any stack that can receive a webhook — your site, your rules.</p>
              </li>
              <li>
                <strong>Analytics &amp; conversion signals</strong>
                <p>Connect lead, call, and conversion data so outcome attribution reflects real business results.</p>
              </li>
              <li>
                <strong>Billing &amp; subscriptions</strong>
                <p>Self-serve trial and plan management so teams can start, scale, and stay on the operating system.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="mk-section mk-final" aria-labelledby="mk-final-title">
          <div className="mk-wrap">
            <p className="mk-eyebrow">Get started</p>
            <h2 id="mk-final-title" className="mk-h2">Put a full AI SEO operating system on your side</h2>
            <p className="mk-lead">
              Start a trial, connect your data, and let the system analyze, recommend, generate,
              execute, monitor, and learn — while you approve what matters.
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
