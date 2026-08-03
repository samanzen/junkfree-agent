"use client";
import type { ReactNode } from "react";
import { IconLock } from "../icons";

// Used where a capability is real and designed, but its data source isn't
// connected for this business yet. Deliberately distinct from EmptyState
// ("connected, nothing to show") so the two are never confused.
export default function ConnectCard({ icon, title, desc, note }: {
  icon?: ReactNode;
  title: string;
  desc: string;
  note?: string;
}) {
  return (
    <div className="p-subcard">
      <div className="p-subcard-top">
        <span className="p-subcard-icon" style={{ background: "var(--surface3)", color: "var(--muted)" }}>
          {icon ?? <IconLock size={16} />}
        </span>
        <span className="p-coming-badge">Not connected</span>
      </div>
      <h3 className="p-subcard-title">{title}</h3>
      <p className="p-subcard-desc">{desc}</p>
      {note && <p style={{ fontSize: 11.5, color: "var(--muted2)", margin: 0 }}>{note}</p>}
    </div>
  );
}
