"use client";
import { useEffect, useLayoutEffect, useRef } from "react";

// ONE table wrapper for both frontends.
//
// Design constraint that shaped everything here: there are 17 tables across 14
// files, every one with its own cells -- sort buttons, badges, links, action
// buttons, progress bars, custom formatting. A component that took `columns`
// and `rows` config would mean rewriting all 17 and re-implementing every
// custom cell, which is exactly how sorting, permissions or a status indicator
// quietly goes missing.
//
// So this wraps the existing <table> untouched and transforms it with CSS. Each
// <td> is stamped with the text of its matching <th>, which the stylesheet
// renders as an inline label when rows become cards below `sm`. Call sites
// change by one line: <div className="p-table-wrap"> becomes <ResponsiveTable>.
// Nothing about the markup inside moves, so no behaviour can be lost.
//
// Labels are derived at runtime rather than hand-written as data-label
// attributes, so a header rename can never leave a stale label behind.

// useLayoutEffect runs before paint, so cards never flash unlabelled. Falls
// back to useEffect on the server, where it would warn and has nothing to do.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type ResponsiveTableProps = {
  children: React.ReactNode;
  /**
   * "stack" (default) turns each row into a labelled card below `sm`.
   * "scroll" keeps horizontal scrolling -- for tables whose value is comparing
   * values ACROSS rows, where splitting them into separate cards destroys the
   * comparison the table exists to make.
   */
  mode?: "stack" | "scroll";
  className?: string;
  style?: React.CSSProperties;
};

/**
 * The column's name, without the controls that live in the header alongside it.
 *
 * Headers in this codebase are not plain text: sortable columns append a ↓/↑
 * arrow, and several carry a MetricExplainer "?" button. Taking textContent
 * verbatim would label cells "Difficulty ?" and "AI Score ↓", with the arrow
 * changing as the user sorts. Buttons, SVG and anything already hidden from
 * assistive tech are dropped, and the standalone arrows with them.
 */
function labelOf(th: HTMLTableCellElement): string {
  const clone = th.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button, svg, [aria-hidden="true"]').forEach((el) => el.remove());
  return (clone.textContent || "")
    .replace(/[↓↑▲▼]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function ResponsiveTable({ children, mode = "stack", className = "", style }: ResponsiveTableProps) {
  const ref = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const table = ref.current?.querySelector("table");
    if (!table) return;

    // Setting display:block on table elements (which the card layout requires)
    // strips their implicit roles from the accessibility tree. Restoring the
    // roles explicitly keeps the table a table for screen readers in both
    // layouts -- without this, the mobile view would announce as plain text.
    table.setAttribute("role", "table");
    table.querySelectorAll(":scope > thead, :scope > tbody, :scope > tfoot")
      .forEach((el) => el.setAttribute("role", "rowgroup"));
    table.querySelectorAll("tr").forEach((el) => el.setAttribute("role", "row"));
    table.querySelectorAll("th").forEach((el) => el.setAttribute("role", "columnheader"));

    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map(labelOf);

    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
      Array.from(row.cells).forEach((cell, i) => {
        cell.setAttribute("role", "cell");
        // A colSpan cell is an empty state or a full-width note, not a value in
        // a column -- labelling it would invent a heading it does not have.
        if (cell.colSpan > 1) {
          cell.removeAttribute("data-label");
          cell.setAttribute("data-full", "");
          return;
        }
        const label = headers[i] ?? "";
        if (label) cell.setAttribute("data-label", label);
        else cell.removeAttribute("data-label");
      });
    });
  });

  return (
    <div ref={ref} className={`rt rt-${mode} ${className}`.trim()} style={style} data-scroll-x>
      {children}
    </div>
  );
}
