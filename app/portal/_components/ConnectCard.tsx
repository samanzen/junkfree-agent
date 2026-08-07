"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { m } from "framer-motion";
import { fadeUp, EASE } from "./motion";
import { IconSparkle, IconCheck, IconChevron, IconAlert } from "../icons";

// Used where a capability is real and designed, but isn't usable for this
// business yet. Framed around the value it unlocks rather than the absence of
// data — deliberately distinct from EmptyState ("connected, nothing to show
// yet") so the two are never confused.
//
// THE DEAD-END PROBLEM THIS TYPE SOLVES
//
// Every card used to render a hardcoded "Available" tag while `cta` was
// optional and `note` was optional, so a card could truthfully claim to be
// available while offering no action and no explanation. 26 of 49 cards in the
// portal were in exactly that state.
//
// The props below make that unrepresentable. A card must supply either:
//
//   cta         — it goes somewhere real that already exists, or
//   requirement — it says exactly what is needed before it can exist.
//
// Supplying neither is a type error, so a dead-end card cannot be added back
// by accident. The tag reflects which of the two it is rather than always
// claiming availability.

type Base = {
  icon?: ReactNode;
  title: string;
  desc: string;
  /** Concrete things this capability gives the customer once live. */
  unlocks?: string[];
};

type WithCta = Base & {
  /** Navigates to a page that already exists. Never claims an action the platform can't perform. */
  cta: { label: string; href: string };
  /** Optional even with a CTA: "here's what's missing, and here's where to fix it". */
  requirement?: string;
};

type WithRequirement = Base & {
  /** Exactly what must happen before this becomes available. Shown verbatim. */
  requirement: string;
  cta?: { label: string; href: string };
};

export type ConnectCardProps = WithCta | WithRequirement;

export default function ConnectCard(props: ConnectCardProps) {
  const { icon, title, desc, unlocks } = props;
  const cta = "cta" in props ? props.cta : undefined;
  const requirement = "requirement" in props ? props.requirement : undefined;

  // A card that still needs something is not "Available", and saying so was
  // the most misleading part of the old card.
  const available = !requirement;

  return (
    <m.div
      className="p-onboard"
      variants={fadeUp}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE } }}
    >
      <div className="p-onboard-top">
        <span className="p-onboard-ico">{icon ?? <IconSparkle size={19} />}</span>
        <span className={`p-onboard-tag ${available ? "" : "pending"}`}>
          {available ? "Available" : "Not yet available"}
        </span>
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

      {requirement && (
        <div className="p-onboard-req">
          <IconAlert size={13} />
          <span>{requirement}</span>
        </div>
      )}

      {cta && (
        <div className="p-onboard-foot">
          <Link href={cta.href} className="p-btn ghost" style={{ padding: "7px 13px", fontSize: 12.5 }}>
            {cta.label} <IconChevron size={13} />
          </Link>
        </div>
      )}
    </m.div>
  );
}
