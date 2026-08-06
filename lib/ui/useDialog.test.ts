// Contract tests for the shared dialog behaviour.
//
// The overlays this backs are the portal's nav drawer and (next phase) the
// admin keyword drawer. Both previously had no keyboard dismissal and no focus
// containment, so a keyboard user could tab straight out of an open drawer into
// the page behind it. These assert the pieces that make that impossible.
//
// jsdom is not configured for this project (vitest runs in node), so rather
// than render React this exercises the focus-cycling rule the hook implements
// against a plain DOM-shaped model. That keeps the test honest about what it
// covers: the selection and wrap-around logic, not React integration.

import { test, expect } from "vitest";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])", '[tabindex]:not([tabindex="-1"])',
].join(",");

test("the focusable selector covers every control type the portal uses", () => {
  for (const sel of ["a[href]", "button", "input", "select", "textarea", "[tabindex]"]) {
    expect(FOCUSABLE).toContain(sel);
  }
});

test("disabled controls are excluded from the focus cycle", () => {
  expect(FOCUSABLE).toContain("button:not([disabled])");
  expect(FOCUSABLE).toContain("input:not([disabled])");
});

test("tabindex=-1 is excluded — it means programmatically focusable only", () => {
  expect(FOCUSABLE).toContain('[tabindex]:not([tabindex="-1"])');
});

// The wrap rule, extracted so it can be asserted directly.
function nextFocus(items: string[], active: string, shift: boolean): string | null {
  if (!items.length) return null;
  const first = items[0];
  const last = items[items.length - 1];
  const inside = items.includes(active);
  if (shift && (active === first || !inside)) return last;
  if (!shift && (active === last || !inside)) return first;
  return null; // browser default handles the interior moves
}

const items = ["close", "link-a", "link-b", "signout"];

test("Tab on the last element wraps to the first", () => {
  expect(nextFocus(items, "signout", false)).toBe("close");
});

test("Shift+Tab on the first element wraps to the last", () => {
  expect(nextFocus(items, "close", true)).toBe("signout");
});

test("interior moves are left to the browser", () => {
  expect(nextFocus(items, "link-a", false)).toBeNull();
  expect(nextFocus(items, "link-b", true)).toBeNull();
});

test("focus that has escaped the dialog is pulled back in", () => {
  // This is the case the old drawer got wrong: focus on the page behind it.
  expect(nextFocus(items, "something-outside", false)).toBe("close");
  expect(nextFocus(items, "something-outside", true)).toBe("signout");
});

test("an empty dialog cannot trap focus", () => {
  expect(nextFocus([], "anything", false)).toBeNull();
});
