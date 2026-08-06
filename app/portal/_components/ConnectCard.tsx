"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { m } from "framer-motion";
import { fadeUp, EASE } from "./motion";
import { IconSparkle, IconCheck, IconChevron } from "../icons";

// Used where a capability is real and designed, but its data source isn't
// connected for this business yet. Framed around the value it unlocks rather
// than the absence of data — deliberately distinct from EmptyState
// ("connected, nothing to show yet") so the two are never confused.
//
// The CTA only ever navigates to an existing portal page; it never claims an
// action the platform can't currently perform.
export default function ConnectCard({
  icon, title, desc, note, unlocks, cta,
}: {
  icon?: ReactNode;
  title: string;
  desc: string;
  note?: string;
  /** Concrete things this capability gives the customer once live. */
  unlocks?: string[];
  cta?: { label: string; href: string };
}) {
  return (
    <m.div
      className="p-onboard"
      variants={fadeUp}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE } }}
    >
      <div className="p-onboard-top">
        <span className="p-onboard-ico">{icon ?? <IconSparkle size={19} />}</span>
        <span className="p-onboard-tag">Available</span>
      </div>

      <h3 className="p-onboard-title">{title}</h3>
      <p className="p-onboard-desc">{desc}</p>

      {unlocks && unlocks.length > 0 && (
        <ul className="p-onboard-list">
          {unlocks.map((u) => (
            <li key={u}><IconCheck size={13} /> {u}</li>
          ))}
        </ul>
      )}

      <div className="p-onboard-foot">
        {note && <span className="p-onboard-note">{note}</span>}
        {cta && (
          <Link href={cta.href} className="p-btn ghost" style={{ padding: "7px 13px", fontSize: 12.5 }}>
            {cta.label} <IconChevron size={13} />
          </Link>
        )}
      </div>
    </m.div>
  );
}
