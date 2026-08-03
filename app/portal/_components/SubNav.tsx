"use client";
import { useId } from "react";
import { m } from "framer-motion";
import { EASE } from "./motion";

// Pill sub-navigation used inside a section page. The active indicator is a
// single shared element that slides between tabs (layoutId), rather than a
// background toggling on each button. Purely presentational; the page owns state.
export default function SubNav<T extends string>({ items, value, onChange }: {
  items: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  // Scopes the shared layout animation to this instance, so two SubNavs on
  // screen never animate into each other.
  const groupId = useId();

  return (
    <div className="p-subnav" role="tablist">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={active}
            className={`p-subnav-btn ${active ? "on" : ""}`}
            onClick={() => onChange(it.key)}
          >
            {active && (
              <m.span
                layoutId={`subnav-${groupId}`}
                className="p-subnav-hl"
                transition={{ duration: 0.28, ease: EASE }}
              />
            )}
            <span className="p-subnav-inner">
              {it.label}
              {it.count != null && <span className="p-subnav-count">{it.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
