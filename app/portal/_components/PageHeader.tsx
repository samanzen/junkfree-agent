"use client";
import type { ReactNode } from "react";

// Consistent page title block for every portal section.
export default function PageHeader({ eyebrow, title, sub, action }: {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <header className="p-pagehead">
      <div>
        {eyebrow && <div className="p-eyebrow">{eyebrow}</div>}
        <h1 className="p-h1">{title}</h1>
        {sub && <p className="p-sub">{sub}</p>}
      </div>
      {action}
    </header>
  );
}
