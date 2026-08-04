"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LazyMotion, MotionConfig, domMax, m, AnimatePresence } from "framer-motion";
import { usePortalAuth } from "@/lib/portalAuth";
import { PORTAL_CSS } from "./portalTheme";
import { EASE } from "./_components/motion";
import {
  IconDashboard, IconIntelligence, IconLocalSeo, IconWebsite, IconContent,
  IconReviews, IconReports, IconBilling, IconSettings, IconAssistant,
  IconSun, IconMoon, IconMenu, IconClose, IconTarget, IconCompetitors, IconTechnical,
} from "./icons";

const NAV_MAIN = [
  { href: "/portal", label: "Dashboard", Icon: IconDashboard, exact: true },
  { href: "/portal/opportunities", label: "Opportunities", Icon: IconTarget },
  { href: "/portal/intelligence", label: "Intelligence", Icon: IconIntelligence },
  { href: "/portal/competitors", label: "Competitors", Icon: IconCompetitors },
  { href: "/portal/local-seo", label: "Local SEO", Icon: IconLocalSeo },
  { href: "/portal/website", label: "Website", Icon: IconWebsite },
  { href: "/portal/technical", label: "Technical SEO", Icon: IconTechnical },
  { href: "/portal/content", label: "Content", Icon: IconContent },
  { href: "/portal/reviews", label: "Reviews", Icon: IconReviews },
];
const NAV_MANAGE = [
  { href: "/portal/reports", label: "Reports", Icon: IconReports },
  { href: "/portal/billing", label: "Billing", Icon: IconBilling },
  { href: "/portal/settings", label: "Settings", Icon: IconSettings },
];
const NAV_AI = [
  { href: "/portal/assistant", label: "AI Assistant", Icon: IconAssistant },
];

type Theme = "light" | "dark";

function usePortalTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(localStorage.getItem("portal-theme") as Theme | null);
  }, []);

  function toggle() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current = theme ?? (prefersDark ? "dark" : "light");
    const next: Theme = current === "dark" ? "light" : "dark";
    localStorage.setItem("portal-theme", next);
    setTheme(next);
  }

  return { theme, toggle };
}

function initials(name?: string) {
  if (!name) return "◆";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const { loading, error, isAdmin, brand, signOut } = usePortalAuth();
  const { theme, toggle } = usePortalTheme();
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  const groups: { label?: string; items: typeof NAV_MAIN }[] = [
    { items: NAV_MAIN },
    { label: "Manage", items: NAV_MANAGE },
    { label: "Assistant", items: NAV_AI },
  ];

  // `navId` scopes the sliding active-pill: the desktop and mobile sidebars can
  // both be mounted at once, and a shared layoutId across the two would make
  // the indicator fly between them.
  const renderSidebar = (navId: string) => (
    <div className="p-side-inner">
      <div className="p-side-brand">
        <span className="p-side-mark">{initials(brand?.name)}</span>
        <span className="p-side-names">
          <span className="p-side-name">{brand?.name || "Your Business"}</span>
          <span className="p-side-sub">AI SEO Platform</span>
        </span>
      </div>
      <nav className="p-side-nav">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && <div className="p-nav-label">{g.label}</div>}
            {g.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={`p-nav-item ${active ? "on" : ""}`}>
                  {active && (
                    <m.span layoutId={navId} className="p-nav-hl" transition={{ duration: 0.3, ease: EASE }} />
                  )}
                  <span className="p-nav-ico"><item.Icon size={16} /></span>
                  <span className="p-nav-text">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="p-side-foot">
        <button className="p-icon-btn" onClick={toggle} aria-label="Toggle colour theme">
          {theme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} />}
        </button>
        <button className="p-signout-btn" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );

  return (
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">
        <div className="portal" data-theme={theme ?? undefined}>
          <style>{PORTAL_CSS}</style>
          <div className="p-shell">
            {/* Desktop sidebar */}
            <aside className="p-side p-side-desktop">{renderSidebar("p-nav-hl-desktop")}</aside>

            {/* Mobile drawer */}
            <AnimatePresence>
              {navOpen && (
                <>
                  <m.div
                    className="p-scrim open"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setNavOpen(false)}
                  />
                  <m.aside
                    className="p-side p-side-mobile"
                    initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                    transition={{ duration: 0.28, ease: EASE }}
                  >
                    {renderSidebar("p-nav-hl-mobile")}
                  </m.aside>
                </>
              )}
            </AnimatePresence>

            <div className="p-main-col">
              <div className="p-topbar">
                <button className="p-icon-btn" onClick={() => setNavOpen((o) => !o)} aria-label="Open navigation">
                  {navOpen ? <IconClose size={17} /> : <IconMenu size={17} />}
                </button>
                <span className="p-side-name">{brand?.name || "Your Business"}</span>
                <button className="p-icon-btn" onClick={toggle} aria-label="Toggle colour theme">
                  {theme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} />}
                </button>
              </div>

              <main className="p-main">
                {isAdmin && (
                  <div className="p-preview">
                    <span>Previewing the customer experience{brand ? ` for ${brand.name}` : ""}.</span>
                    <Link href="/dashboard" className="p-btn ghost" style={{ padding: "5px 12px", fontSize: 12 }}>
                      Back to admin
                    </Link>
                  </div>
                )}
                {loading ? <ShellSkeleton /> : error ? <ShellError msg={error} /> : children}
              </main>
            </div>
          </div>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

function ShellSkeleton() {
  return (
    <div className="p-stack">
      <div className="p-skel" style={{ height: 268, borderRadius: 26 }} />
      <div className="p-score-grid">
        {[...Array(5)].map((_, i) => <div key={i} className="p-skel" style={{ height: 152 }} />)}
      </div>
      <div className="p-2col">
        <div className="p-skel" style={{ height: 280 }} />
        <div className="p-skel" style={{ height: 280 }} />
      </div>
    </div>
  );
}

function ShellError({ msg }: { msg: string }) {
  return (
    <div className="p-empty">
      <div className="p-empty-icon">!</div>
      <div className="p-empty-title">{msg}</div>
    </div>
  );
}
