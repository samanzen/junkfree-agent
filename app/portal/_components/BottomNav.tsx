"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "framer-motion";
import { EASE } from "./motion";
import { IconDashboard, IconCheck, IconIntelligence, IconAssistant, IconMenu } from "../icons";

// Mobile bottom navigation. Appears below the `md` breakpoint, where the
// sidebar is replaced by a drawer.
//
// This SUPPLEMENTS the drawer, it does not replace it: four destinations get a
// permanent thumb-reachable home, and "More" opens the same drawer that already
// holds the full intent-grouped list. Approvals sits on the bar so pending
// decisions stay one tap away; everything else remains reachable via More.

const ITEMS = [
  { href: "/portal", label: "Home", Icon: IconDashboard, exact: true },
  { href: "/portal/approvals", label: "Approvals", Icon: IconCheck, badge: "approvals" as const },
  { href: "/portal/intelligence", label: "Rankings", Icon: IconIntelligence },
  { href: "/portal/assistant", label: "Ask", Icon: IconAssistant },
];

export default function BottomNav({
  onMore, moreOpen, approvalCount = 0,
}: {
  onMore: () => void;
  moreOpen: boolean;
  approvalCount?: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="p-bnav" aria-label="Primary">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const badge = item.badge === "approvals" && approvalCount > 0 ? approvalCount : null;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`p-bnav-item ${active ? "on" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="p-bnav-ico">
              {active && (
                <m.span
                  layoutId="p-bnav-active"
                  className="p-bnav-pill"
                  transition={{ duration: 0.28, ease: EASE }}
                />
              )}
              <item.Icon size={19} />
              {badge != null && (
                <span className="p-bnav-count" aria-label={`${badge} waiting`}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span className="p-bnav-label">{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        className={`p-bnav-item ${moreOpen ? "on" : ""}`}
        onClick={onMore}
        aria-expanded={moreOpen}
        aria-label="More sections"
      >
        <span className="p-bnav-ico"><IconMenu size={19} /></span>
        <span className="p-bnav-label">More</span>
      </button>
    </nav>
  );
}
