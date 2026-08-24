"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Small promotional card — visually separate from Connect Website.
 * Links to the Coming Soon website-builder landing page.
 */
export default function WebsiteBuilderPromo() {
  return (
    <div className="p-wb-promo" role="complementary" aria-label="Website builder offer">
      <div className="p-wb-promo-copy">
        <div className="p-wb-promo-eyebrow">Optional</div>
        <h3 className="p-wb-promo-title">Get a New SEO-Ready Website — Free</h3>
        <p className="p-wb-promo-text">
          Subscribe to our SEO platform and we&apos;ll build your new website for free,
          including six months of website hosting and builder access.
        </p>
      </div>
      <Link className="p-btn primary p-wb-promo-cta" href="/website-builder">
        <span>See How It Works</span>
      </Link>
    </div>
  );
}
