"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LazyMotion, MotionConfig, domMax, m, AnimatePresence } from "framer-motion";
import { usePortalAuth } from "@/lib/portalAuth";
import { useDialog } from "@/lib/ui/useDialog";
import { pageTitle, PLATFORM_TAGLINE } from "@/lib/ui/tokens";
import { PORTAL_CSS } from "./portalTheme";
import { EASE } from "./_components/motion";
import BottomNav from "./_components/BottomNav";
import CommandPalette from "./_components/CommandPalette";
import { useApprovalCounts } from "./_data";
import { NAV_GROUPS, type NavItem } from "./nav";
import {
  IconSun, IconMoon, IconMenu, IconClose,
} from "./icons";

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

function isActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const { loading, error, isAdmin, brand, signOut } = usePortalAuth();
  const { theme, toggle } = usePortalTheme();
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const approvalCounts = useApprovalCounts(brand?.id, pathname);

  // The browser tab carries the SIGNED-IN tenant's own name.
  //
  // Set here rather than through generateMetadata because the portal resolves
  // its brand client-side from a bearer token in localStorage — the server
  // rendering this page has no idea which tenant is about to be shown. Falls
  // back to the neutral platform name whenever no brand is resolved, so a
  // customer never sees another tenant's name and never sees a blank title.
  useEffect(() => {
    document.title = pageTitle(brand?.name);
  }, [brand?.name]);

  // Focus returns to whichever control opened the drawer — the topbar button or
  // the bottom bar's "More" — rather than to the top of the document.
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useDialog<HTMLElement>({
    open: navOpen,
    onClose: () => setNavOpen(false),
    restoreTo: menuBtnRef,
  });

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  const scrollGroups = NAV_GROUPS.filter((g) => g.pin !== "footer");
  const footerGroups = NAV_GROUPS.filter((g) => g.pin === "footer");

  const renderItem = (item: NavItem, navId: string) => {
    const active = isActive(item, pathname);
    const badge = item.badge === "approvals" && approvalCounts.total > 0
      ? approvalCounts.total
      : null;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`p-nav-item ${active ? "on" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        {active && (
          <m.span layoutId={navId} className="p-nav-hl" transition={{ duration: 0.28, ease: EASE }} />
        )}
        <span className="p-nav-ico"><item.Icon size={16} /></span>
        <span className="p-nav-text">{item.label}</span>
        {badge != null && (
          <span className="p-nav-count" aria-label={`${badge} waiting`}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
    );
  };

  // `navId` scopes the sliding active-pill: the desktop and mobile sidebars can
  // both be mounted at once, and a shared layoutId across the two would make
  // the indicator fly between them.
  const renderSidebar = (navId: string) => (
    <div className="p-side-inner">
      <div className="p-side-brand">
        <span className="p-side-mark">{initials(brand?.name)}</span>
        <span className="p-side-names">
          <span className="p-side-name">{brand?.name || "Your Business"}</span>
          <span className="p-side-sub">{PLATFORM_TAGLINE}</span>
        </span>
      </div>
      <nav className="p-side-nav">
        {scrollGroups.map((g) => (
          <div key={g.label}>
            <div className="p-nav-label">{g.label}</div>
            {g.items.map((item) => renderItem(item, navId))}
          </div>
        ))}
      </nav>
      <div className="p-side-foot">
        {footerGroups.map((g) => (
          <div key={g.label} className="p-side-pin">
            {g.items.map((item) => renderItem(item, navId))}
          </div>
        ))}
        <div className="p-side-foot-row">
          <button className="p-icon-btn" onClick={toggle} aria-label="Toggle colour theme">
            {theme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} />}
          </button>
          <button className="p-signout-btn" onClick={signOut}>Sign out</button>
        </div>
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
                    transition={{ duration: 0.18 }}
                    onClick={() => setNavOpen(false)}
                  />
                  <m.aside
                    ref={drawerRef}
                    className="p-side p-side-mobile"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Sections"
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
                <button
                  ref={menuBtnRef}
                  className="p-icon-btn"
                  onClick={() => setNavOpen((o) => !o)}
                  aria-label={navOpen ? "Close navigation" : "Open navigation"}
                  aria-expanded={navOpen}
                >
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
                {loading ? <ShellSkeleton /> : error ? <ShellError msg={error} isAdmin={isAdmin} /> : children}
              </main>

              {/* Thumb-reachable nav below md. "More" opens the same drawer,
                  so every section stays reachable — nothing is mobile-only. */}
              <BottomNav
                onMore={() => setNavOpen((o) => !o)}
                moreOpen={navOpen}
                approvalCount={approvalCounts.total}
              />
            </div>
          </div>
          <CommandPalette />
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

// A failure state has to offer a way OUT, or it is just a nicer dead end.
// An admin who lands here has no brand context, and the place that supplies
// one is the dashboard — so say that and link there. Everyone gets retry,
// because the most common cause is a transient network failure.
function ShellError({ msg, isAdmin }: { msg: string; isAdmin: boolean }) {
  return (
    <div className="p-empty">
      <div className="p-empty-icon">!</div>
      <div className="p-empty-title">We couldn&apos;t open your portal</div>
      <p className="p-empty-sub">{msg}</p>
      <div style={{ marginTop: 20, display: "flex", gap: 9, justifyContent: "center", flexWrap: "wrap" }}>
        {isAdmin && (
          <Link href="/dashboard" className="p-btn primary">Choose a customer</Link>
        )}
        <button className="p-btn ghost" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </div>
  );
}
