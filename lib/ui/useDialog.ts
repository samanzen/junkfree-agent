"use client";
import { useEffect, useRef } from "react";

// Dialog behaviour shared by every overlay in the platform.
//
// The portal's nav drawer and the admin keyword drawer were both built as a
// scrim <div onClick> plus a panel: visually correct, but with no way to
// dismiss them from the keyboard, no containment of focus, and nothing
// returning focus to whatever opened them. A keyboard or screen-reader user
// could tab straight out of an "open" drawer into the page behind it.
//
// Extracted here rather than written twice, so both overlays get identical
// behaviour and any future one gets it for free.

type Options = {
  open: boolean;
  onClose: () => void;
  /** Element to restore focus to on close. Defaults to whatever had it. */
  restoreTo?: React.RefObject<HTMLElement | null>;
  /**
   * Modal (default) traps focus and locks background scroll — correct for a
   * drawer or sheet that owns the screen.
   *
   * Set false for a popover: it still closes on Escape and still restores
   * focus, but does not trap or lock, because a small informational popover
   * that steals focus and freezes the page behind it is worse than one that
   * does neither. Same implementation, correct semantics for each.
   */
  modal?: boolean;
};

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])", '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Returns a ref to attach to the dialog container. While `open`:
 *  - Escape closes it
 *  - Tab and Shift+Tab cycle within it instead of escaping to the page
 *  - focus moves to the first focusable element on open
 *  - focus returns to the opener on close
 *  - background scroll is locked
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>({ open, onClose, restoreTo, modal = true }: Options) {
  const ref = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = (document.activeElement as HTMLElement) || null;

    // Move focus into a modal so the next Tab stays inside it. A popover leaves
    // focus where the user put it — pulling it away would lose their place.
    if (modal) {
      const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (!modal || e.key !== "Tab" || !ref.current) return;

      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;

      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement as HTMLElement;

      // Wrap at both ends, and pull focus back in if it has already escaped.
      if (e.shiftKey && (active === firstEl || !ref.current.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (active === lastEl || !ref.current.contains(active))) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    // Lock background scroll without the layout shift a scrollbar removal
    // would cause on desktop. Modal only — a popover must not freeze the page.
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    if (modal) {
      const gap = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (modal) {
        document.body.style.overflow = prevOverflow;
        document.body.style.paddingRight = prevPadding;
      }
      const target = restoreTo?.current || previouslyFocused.current;
      // Only restore if focus is still inside the closing dialog, so we never
      // yank it away from somewhere the user has deliberately moved it.
      if (target && (!document.activeElement || ref.current?.contains(document.activeElement))) {
        target.focus();
      }
    };
  }, [open, onClose, restoreTo, modal]);

  return ref;
}
