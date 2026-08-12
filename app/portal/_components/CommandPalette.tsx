"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/lib/ui/useDialog";
import Field from "@/app/_components/Field";
import { NAV_GROUPS, NAV_ROUTES } from "../nav";

// Route-only command palette (v1). Opens on ⌘K / Ctrl+K from anywhere in the
// portal shell. Record search and verbs come later — this only jumps to
// destinations so a 13+ page product stays keyboard-reachable.

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
    if (!q) {
      return NAV_GROUPS.flatMap((g) =>
        g.items.map((item) => ({ ...item, group: g.label })),
      );
    }
    return NAV_ROUTES
      .filter((item) => item.label.toLowerCase().includes(q) || item.href.includes(q))
      .map((item) => {
        const group = NAV_GROUPS.find((g) => g.items.some((i) => i.href === item.href))?.label || "";
        return { ...item, group };
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
      {/* Decorative — Escape via useDialog already closes the palette. */}
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
            placeholder="Go to…"
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
              <li key={item.href} role="option" id={`p-cmd-opt-${i}`} aria-selected={i === active}>
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
