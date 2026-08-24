import type { Metadata } from "next";
import Link from "next/link";
import NotifyInterestForm from "./NotifyInterestForm";

export const metadata: Metadata = {
  title: "SEO-Ready Website — Coming Soon | Volo",
  description:
    "Subscribe to the Volo SEO platform and get a new SEO-ready website built for you, with six months of hosting and builder access.",
};

/**
 * Coming Soon landing for the website-builder offer.
 * Linked from the Connections promotional card. No full builder yet.
 */
export default function WebsiteBuilderComingSoonPage() {
  return (
    <main className="wb-soon">
      <style>{`
        .wb-soon { min-height: 100vh; background: linear-gradient(165deg, #0f1c17 0%, #1a2e26 45%, #243d32 100%); color: #f4f7f5; font-family: Georgia, "Times New Roman", serif; }
        .wb-soon-inner { max-width: 640px; margin: 0 auto; padding: 72px 24px 96px; }
        .wb-soon-mark { font-family: "Segoe UI", system-ui, sans-serif; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9db5a8; margin-bottom: 20px; }
        .wb-soon h1 { font-size: clamp(30px, 5vw, 42px); line-height: 1.12; font-weight: 700; margin: 0 0 16px; letter-spacing: -0.02em; }
        .wb-soon h2 { font-family: "Segoe UI", system-ui, sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #9db5a8; margin: 36px 0 12px; }
        .wb-soon .lead { font-family: "Segoe UI", system-ui, sans-serif; font-size: 17px; line-height: 1.55; color: #c5d4cb; margin: 0 0 28px; }
        .wb-soon ul { font-family: "Segoe UI", system-ui, sans-serif; margin: 0 0 20px; padding-left: 1.15em; color: #c5d4cb; line-height: 1.7; font-size: 15px; }
        .wb-soon li { margin-bottom: 8px; }
        .wb-soon-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 24px; font-family: "Segoe UI", system-ui, sans-serif; }
        .wb-soon .fine { font-size: 12.5px; color: #8a9e93; margin-top: 14px; line-height: 1.5; }
        .wb-soon .back { font-family: "Segoe UI", system-ui, sans-serif; display: inline-block; margin-top: 28px; color: #9db5a8; font-size: 14px; text-decoration: none; }
        .wb-soon .back:hover { color: #c5d4cb; }
        .wb-soon .note { font-family: "Segoe UI", system-ui, sans-serif; margin-top: 28px; font-size: 13px; color: #8a9e93; line-height: 1.55; }
        .wb-soon .flow { font-family: "Segoe UI", system-ui, sans-serif; font-size: 14px; color: #c5d4cb; line-height: 1.7; margin: 0 0 12px; }
        .wb-notify .fld-label { color: #9db5a8 !important; }
        .wb-notify-input {
          width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.18); background: rgba(0,0,0,0.25); color: #fff; font-size: 15px;
        }
        .wb-notify-btn {
          width: 100%; margin-top: 14px; padding: 13px 16px; border: 0; border-radius: 10px;
          background: #3ecf8e; color: #0b1612; font-weight: 700; font-size: 15px; cursor: pointer;
        }
        .wb-notify-done { margin: 0; color: #3ecf8e; font-weight: 600; }
      `}</style>
      <div className="wb-soon-inner">
        <div className="wb-soon-mark">Coming soon</div>
        <h1>Your New SEO-Ready Website, Built for You</h1>
        <p className="lead">
          With an active Volo SEO subscription, we&apos;ll build your new website for free —
          including six months of hosting and website-builder access. Pricing after six months
          will be shown clearly before you activate anything paid.
        </p>
        <ul>
          <li>Designed to be SEO-ready from the start</li>
          <li>Future migrations will preserve important SEO signals (URLs, metadata, schema, redirects)</li>
          <li>You approve the preview before any domain switch</li>
        </ul>

        <div className="wb-soon-card">
          <NotifyInterestForm />
          <p className="fine">
            We&apos;ll only use this to tell you when the offer is ready. The waitlist will be
            connected when the product launches.
          </p>
        </div>

        <h2>Future migration (planned)</h2>
        <p className="flow">
          crawl and inventory → automated rebuild → preview → SEO comparison → customer approval →
          domain switch → post-launch monitoring → rollback if necessary
        </p>
        <p className="flow">The migration engine must preserve or migrate:</p>
        <ul>
          <li>Existing URLs (with 301 redirects when a URL must change)</li>
          <li>Page content, headings, images and alt text</li>
          <li>Metadata, canonical tags, schema, and internal links</li>
          <li>Robots rules, sitemap, analytics and tracking configuration</li>
        </ul>

        <p className="note">
          We do not promise guaranteed rankings or that every migration will have zero SEO impact.
          The rebuild and migration process is designed to preserve existing SEO signals and use
          301 redirects when URLs must change. The full website builder and migration engine are
          not available yet — this page collects interest only.
        </p>

        <Link className="back" href="/portal/settings?tab=connections">
          ← Back to Connections
        </Link>
      </div>
    </main>
  );
}
