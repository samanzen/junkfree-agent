"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "framer-motion";
import { EASE } from "./motion";
import { IconDashboard, IconTarget, IconIntelligence, IconAssistant, IconMenu } from "../icons";

// Mobile bottom navigation. Appears below the `md` breakpoint, where the
// sidebar is replaced by a drawer.
//
// This SUPPLEMENTS the drawer, it does not replace it: four destinations get a
// permanent thumb-reachable home, and "More" opens the same drawer that already
// holds all thirteen. No destination becomes unreachable, and nothing here is a
// second implementation of the nav -- the drawer remains the single source for
// the full list.
//
// The four were chosen from what a business owner does on a phone: check how
// they're doing, see what needs them, look at the numbers, ask a question.
// Content approvals stay one tap away through the dashboard's priority cards.

const ITEMS = [
  { href: "/portal", label: "Home", Icon: IconDashboard, exact: true },
  { href: "/portal/opportunities", label: "Actions", Icon: IconTarget },
  { href: "/portal/intelligence", label: "Rankings", Icon: IconIntelligence },
  { href: "/portal/assistant", label: "Ask", Icon: IconAssistant },
];

export default function BottomNav({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="p-bnav" aria-label="Primary">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
