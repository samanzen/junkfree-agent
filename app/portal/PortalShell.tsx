"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalAuth } from "@/lib/portalAuth";
import { PORTAL_CSS } from "./portalTheme";
import {
  IconDashboard, IconIntelligence, IconLocalSeo, IconWebsite, IconContent,
  IconReviews, IconReports, IconBilling, IconSettings, IconAssistant,
  IconSun, IconMoon, IconMenu,
} from "./icons";

const NAV = [
  { href: "/portal", label: "Dashboard", Icon: IconDashboard, exact: true },
  { href: "/portal/intelligence", label: "Intelligence", Icon: IconIntelligence },
  { href: "/portal/local-seo", label: "Local SEO", Icon: IconLocalSeo },
  { href: "/portal/website", label: "Website", Icon: IconWebsite },
  { href: "/portal/content", label: "Content", Icon: IconContent },
  { href: "/portal/reviews", label: "Reviews", Icon: IconReviews },
  { href: "/portal/reports", label: "Reports", Icon: IconReports },
  { href: "/portal/billing", label: "Billing", Icon: IconBilling },
  { href: "/portal/settings", label: "Settings", Icon: IconSettings },
  { href: "/portal/assistant", label: "AI Assistant", Icon: IconAssistant },
];

type Theme = "light" | "dark";

function usePortalTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("portal-theme") as Theme | null;
    setTheme(stored);
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

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const { loading, error, isAdmin, brand, signOut } = usePortalAuth();
  const { theme, toggle } = usePortalTheme();
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="portal" data-theme={theme ?? undefined}>
      <style>{PORTAL_CSS}</style>
      <div className="p-shell">
        <aside className={`p-side ${navOpen ? "open" : ""}`}>
          <div className="p-side-brand">
            <span className="p-side-dot" />
            <span className="p-side-name">{brand?.name || "Your Business"}</span>
          </div>
          <nav className="p-side-nav">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={`p-nav-item ${active ? "on" : ""}`}
                  onClick={() => setNavOpen(false)}>
                  <item.Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-side-foot">
            <button className="p-theme-btn" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
              {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
            <button className="p-signout-btn" onClick={signOut}>Sign out</button>
          </div>
        </aside>

        <div className={`p-scrim ${navOpen ? "open" : ""}`} onClick={() => setNavOpen(false)} />

        <div className="p-main-col">
          <div className="p-topbar">
            <button className="p-topbar-menu" onClick={() => setNavOpen(true)} aria-label="Open menu">
              <IconMenu size={22} />
            </button>
            <span className="p-side-name">{brand?.name || "Your Business"}</span>
            <button className="p-theme-btn" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
          </div>

          <main className="p-main">
            {isAdmin && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                background: "var(--amber-soft)", border: "1px solid var(--line)", borderRadius: 12,
                padding: "9px 16px", marginBottom: 22, fontSize: 12.5,
              }}>
                <span>👁 Previewing the customer experience{brand ? ` for ${brand.name}` : ""}.</span>
                <Link href="/dashboard" className="p-btn ghost" style={{ padding: "5px 12px", fontSize: 12 }}>
                  ← Back to admin
                </Link>
              </div>
            )}
            {loading ? <ShellSkeleton /> : error ? <ShellError msg={error} /> : children}
          </main>
        </div>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="p-skel" style={{ height: 100, width: "60%" }} />
      <div className="p-kpi-grid">
        {[...Array(5)].map((_, i) => <div key={i} className="p-skel" style={{ height: 110 }} />)}
      </div>
      <div className="p-skel" style={{ height: 220 }} />
    </div>
  );
}

function ShellError({ msg }: { msg: string }) {
  return (
    <div className="p-empty">
      <div className="p-empty-icon">⚠️</div>
      <div className="p-empty-title">{msg}</div>
    </div>
  );
}
