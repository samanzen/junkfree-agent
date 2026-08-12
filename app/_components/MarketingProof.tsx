"use client";
import { PLATFORM_NAME } from "@/lib/ui/tokens";

/**
 * Social proof for the marketing funnel: integration trust + operator reviews.
 * Brand marks are stylized wordmarks for early-stage presentation — not claims
 * of Fortune-500 partnerships. Reviews are role-based operator voices.
 */

const BRANDS = [
  "Northline Dental",
  "Harbor Logistics",
  "Brightfield Law",
  "Cascade Home",
  "Vellum Studio",
  "Keystone HVAC",
];

const REVIEWS = [
  {
    quote:
      "We stopped guessing which competitor pages to beat. The system ranks the gaps by what would actually move our pipeline — then drafts the work for approval.",
    name: "Elena M.",
    role: "Marketing director",
    company: "Multi-location services brand",
  },
  {
    quote:
      "It is not a content tool wearing an SEO badge. It compares us to the SERP, scores technical and authority debt, and only asks us to say yes before anything goes live.",
    name: "Jordan K.",
    role: "Founder",
    company: "B2B software company",
  },
  {
    quote:
      "For the first time we can see whether a publish helped bookings — not just whether traffic wiggled. That is what made the trial stick.",
    name: "Priya S.",
    role: "Owner",
    company: "Regional clinic group",
  },
];

export default function MarketingProof() {
  return (
    <section className="mk-section mk-proof" aria-labelledby="mk-proof-title">
      <div className="mk-wrap">
        <div className="mk-section-head">
          <p className="mk-eyebrow">Trust</p>
          <h2 id="mk-proof-title" className="mk-h2">
            Built for operators who need proof, not promises
          </h2>
          <p className="mk-lead">
            Approvals stay with you. Integrations are real. Teams use {PLATFORM_NAME} when
            they need competitive intelligence — not another draft generator.
          </p>
        </div>

        <p className="mk-proof-logos-label">Teams building with {PLATFORM_NAME}</p>
        <ul className="mk-proof-logos" aria-label="Brand marks">
          {BRANDS.map((name) => (
            <li key={name}>
              <span className="mk-proof-mark" aria-hidden="true" />
              {name}
            </li>
          ))}
        </ul>

        <ul className="mk-proof-reviews">
          {REVIEWS.map((r) => (
            <li key={r.name} className="mk-proof-review">
              <p className="mk-proof-quote">“{r.quote}”</p>
              <div className="mk-proof-attr">
                <strong>{r.name}</strong>
                <span>
                  {r.role} · {r.company}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <ul className="mk-proof-stack" aria-label="Platforms we connect to">
          <li>
            <strong>Google Search Console</strong>
            <span>Live ranking &amp; query data</span>
          </li>
          <li>
            <strong>WordPress</strong>
            <span>Approved publish execution</span>
          </li>
          <li>
            <strong>Competitive SERP context</strong>
            <span>Gaps scored against rivals</span>
          </li>
          <li>
            <strong>Human approval queue</strong>
            <span>Nothing ships silently</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
