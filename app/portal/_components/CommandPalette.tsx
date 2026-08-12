"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/lib/ui/useDialog";
import Field from "@/app/_components/Field";
import { NAV_GROUPS, NAV_ROUTES } from "../nav";
import {
  IconCheck, IconSettings, IconSparkle, IconTarget, IconTraffic,
} from "../icons";

// Command palette: routes + a few high-value verbs that jump to existing
// authenticated destinations (setup, approvals, opportunities, results).

type CmdItem = {
  href: string;
  label: string;
  group: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

const VERBS: CmdItem[] = [
  { href: "/portal/setup", label: "Continue setup", group: "Actions", Icon: IconSparkle },
  { href: "/portal/approvals", label: "Review approvals", group: "Actions", Icon: IconCheck },
  { href: "/portal/opportunities", label: "Open opportunities", group: "Actions", Icon: IconTarget },
  { href: "/portal/results", label: "See outcome trails", group: "Actions", Icon: IconTraffic },
  { href: "/portal/settings", label: "Manage connections", group: "Actions", Icon: IconSettings },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const dialogRef = useDialog<HTMLDivElement>({
    open,
    onClose: close,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const routes: CmdItem[] = !q
      ? NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label })))
      : NAV_ROUTES
          .filter((item) => item.label.toLowerCase().includes(q) || item.href.includes(q))
          .map((item) => {
            const group = NAV_GROUPS.find((g) => g.items.some((i) => i.href === item.href))?.label || "";
            return { ...item, group };
          });

    const verbs = VERBS.filter(
      (v) => !q || v.label.toLowerCase().includes(q) || v.href.includes(q)
    );
    // Verbs first when searching; when idle, show verbs then routes.
    const merged = q ? [...verbs, ...routes] : [...verbs, ...routes];
    // Dedupe by href keeping first (verb wins).
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
  }, [query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  function go(href: string) {
    close();
    router.push(href);
  }

  function onListKey(e: React.KeyboardEvent) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active].href);
    }
  }

  if (!open) return null;

  return (
    <div className="p-cmd-root" role="presentation">
      <div className="p-cmd-scrim" onClick={close} aria-hidden="true" />
      <div
        ref={dialogRef}
        className="p-cmd"
        role="dialog"
        aria-modal="true"
        aria-label="Go to"
      >
        <div className="p-cmd-bar">
          <Field
            hideLabel
            label="Go to"
            type="search"
            className="p-cmd-field"
            inputClassName="p-cmd-input"
            placeholder="Go to a page or action…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onListKey}
            aria-controls="p-cmd-list"
            aria-activedescendant={results[active] ? `p-cmd-opt-${active}` : undefined}
            autoComplete="off"
          />
          <kbd className="p-cmd-kbd">esc</kbd>
        </div>
        <ul id="p-cmd-list" className="p-cmd-list" role="listbox" aria-label="Destinations">
          {results.length === 0 ? (
            <li className="p-cmd-empty">No matching destinations</li>
          ) : (
            results.map((item, i) => (
              <li key={`${item.group}:${item.href}`} role="option" id={`p-cmd-opt-${i}`} aria-selected={i === active}>
                <button
                  type="button"
                  className={`p-cmd-item ${i === active ? "on" : ""}`}
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="p-cmd-ico"><item.Icon size={15} /></span>
                  <span className="p-cmd-label">{item.label}</span>
                  <span className="p-cmd-group">{item.group}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
