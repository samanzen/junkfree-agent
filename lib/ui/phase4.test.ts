// Phase 4: forms, feedback and loading.
//
// The properties worth locking down are the accessibility wiring (which is
// invisible until a screen reader hits it) and the "no browser dialogs remain"
// guarantee, which is easy to regress by adding one alert() in a hurry.

import fs from "fs";
import { test, expect } from "vitest";
import { fieldCSS, GLOBAL_CSS } from "./tokens";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

const VARS = {
  surface: "var(--surface)", line: "var(--line)", lineStrong: "var(--line-strong)",
  muted: "var(--muted)", text: "var(--text)", accent: "var(--accent)",
  danger: "var(--red)", radius: "10px",
};

// ── No browser dialogs ──────────────────────────────────────────────────────
function appFiles(dir = "app", acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(`${ROOT}/${dir}`, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) appFiles(p, acc);
    else if (p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

test("no alert(), confirm() or prompt() survives anywhere in app/", () => {
  const offenders: string[] = [];
  for (const f of appFiles()) {
    // Notify.tsx names them in its own explanatory comment.
    if (f.endsWith("_components/Notify.tsx")) continue;
    const code = read(f).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    if (/(?<![.\w])(alert|prompt)\s*\(/.test(code) || /window\.confirm\s*\(/.test(code)) offenders.push(f);
  }
  expect(offenders).toEqual([]);
});

test("every form control goes through the shared Field", () => {
  const offenders: string[] = [];
  for (const f of appFiles()) {
    if (f.endsWith("_components/Field.tsx")) continue;
    if (/<(input|select|textarea)[\s>]/.test(read(f))) offenders.push(f);
  }
  expect(offenders).toEqual([]);
});

// ── Field markup contract ───────────────────────────────────────────────────
const FIELD_SRC = read("app/_components/Field.tsx");

test("labels are bound to their control by htmlFor/id", () => {
  expect(FIELD_SRC).toMatch(/<label htmlFor=\{id\}/);
  expect(FIELD_SRC).toMatch(/const id = /);
});

test("all six control types are supported", () => {
  for (const t of ["textarea", "select", "checkbox", "radio", "switch", "input"]) {
    expect(FIELD_SRC).toContain(`"${t}"`);
  }
});

test("invalid fields are marked and described, not just coloured", () => {
  expect(FIELD_SRC).toContain('"aria-invalid"');
  expect(FIELD_SRC).toContain('"aria-describedby"');
  expect(FIELD_SRC).toMatch(/role="alert"/);
});

test("aria-describedby only references ids that are actually rendered", () => {
  expect(FIELD_SRC).toMatch(/helper \? helperId : null, error \? errorId : null/);
});

test("required is conveyed to screen readers, not by an asterisk alone", () => {
  expect(FIELD_SRC).toMatch(/fld-sr"> \(required\)/);
  expect(FIELD_SRC).toMatch(/fld-req" aria-hidden="true">\*/);
});

test("loading marks the control busy and disables it", () => {
  expect(FIELD_SRC).toContain('"aria-busy"');
  expect(FIELD_SRC).toMatch(/disabled: disabled \|\| loading/);
});

test("focusFirstError targets the invalid control", () => {
  expect(FIELD_SRC).toMatch(/querySelector<HTMLElement>\('\[aria-invalid="true"\]'\)/);
});

// ── Field CSS ───────────────────────────────────────────────────────────────
test("field CSS is scoped to its surface", () => {
  expect(fieldCSS(".portal", VARS)).not.toContain(".sr ");
  expect(fieldCSS(".sr", VARS)).not.toContain(".portal ");
});

test("colours are injected, never hardcoded", () => {
  // #fff on the switch knob is deliberate and theme-independent.
  const css = fieldCSS(".portal", VARS).replace(/background:#fff;/g, "");
  expect(css).not.toMatch(/#[0-9a-fA-F]{6}/);
});

test("the busy state reserves its space so nothing reflows", () => {
  const css = fieldCSS(".sr", VARS);
  expect(css).toMatch(/\[data-busy="true"\] > \* \{ visibility:hidden/);
  expect(css).toMatch(/\[data-busy="true"\]::after/);
});

test("the visually-hidden helper keeps text available to screen readers", () => {
  expect(fieldCSS(".sr", VARS)).toMatch(/\.fld-sr \{[\s\S]*?clip-path:inset\(50%\)/);
});

// ── Notify ──────────────────────────────────────────────────────────────────
const NOTIFY_SRC = read("app/_components/Notify.tsx");

test("all four toast kinds exist", () => {
  for (const k of ["success", "error", "warning", "info"]) expect(NOTIFY_SRC).toContain(`"${k}"`);
});

test("errors persist until dismissed; the rest auto-dismiss", () => {
  expect(NOTIFY_SRC).toMatch(/error:\s*0,/);
  expect(NOTIFY_SRC).toMatch(/success:\s*\d{4},/);
});

test("urgent and routine announcements use different live regions", () => {
  expect(NOTIFY_SRC).toMatch(/role="alert" aria-live="assertive"/);
  expect(NOTIFY_SRC).toMatch(/role="status" aria-live="polite"/);
});

test("toasts can be dismissed manually and stack is capped", () => {
  expect(NOTIFY_SRC).toMatch(/aria-label="Dismiss notification"/);
  expect(NOTIFY_SRC).toMatch(/\.slice\(-4\)/);
});

test("hovering or focusing a toast pauses its timer", () => {
  expect(NOTIFY_SRC).toMatch(/onMouseEnter=\{\(\) => setPaused\(true\)\}/);
  expect(NOTIFY_SRC).toMatch(/onFocus=\{\(\) => setPaused\(true\)\}/);
});

test("confirm is a modal alertdialog reusing the shared dialog behaviour", () => {
  expect(NOTIFY_SRC).toMatch(/role="alertdialog"/);
  expect(NOTIFY_SRC).toMatch(/aria-modal="true"/);
  expect(NOTIFY_SRC).toContain("useDialog");
});

test("dismissing the confirm resolves false, as a native confirm did", () => {
  expect(NOTIFY_SRC).toMatch(/onClose: \(\) => onResolve\(false\)/);
});

test("toast motion relies on the global reduced-motion rule, not a duplicate", () => {
  // GLOBAL_CSS neutralises animation on every element with !important, so a
  // Notify-scoped copy would be a second declaration of the same rule — which
  // is exactly what the Phase 2 breakpoint test caught when it was added.
  expect(NOTIFY_SRC).not.toMatch(/@media \(prefers-reduced-motion/);
  expect(GLOBAL_CSS).toMatch(/prefers-reduced-motion:reduce/);
  expect(GLOBAL_CSS).toMatch(/animation-duration:\.01ms !important/);
});

test("the toast viewport clears the mobile bottom nav", () => {
  expect(NOTIFY_SRC).toMatch(/bottom:calc\(78px \+ env\(safe-area-inset-bottom\)\)/);
});
