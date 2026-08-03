"use client";
import { m, type Variants, type Transition } from "framer-motion";
import type { ReactNode } from "react";

// Shared motion vocabulary for the portal. Everything here is presentational —
// no component below changes data, props flow, or behaviour.
//
// Bundle: pages import `m` (not `motion`) and PortalShell mounts a single
// LazyMotion provider, so the animation feature set is loaded once and the
// heavy `motion` factory never ships. Reduced motion is honoured globally by
// <MotionConfig reducedMotion="user"> in PortalShell plus a CSS fallback.

/** Standard easing — matches the "confident, quick, no bounce" feel of Linear/Vercel. */
export const EASE: Transition["ease"] = [0.16, 1, 0.3, 1];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

/** Parent that reveals children one after another. */
const staggerParent = (stagger: number, delayChildren = 0.02): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

/**
 * Reveals its children with a staggered fade-up as soon as they mount.
 * Use for a grid or list of cards.
 */
export function Stagger({ children, className, stagger = 0.055, style }: {
  children: ReactNode; className?: string; stagger?: number; style?: React.CSSProperties;
}) {
  return (
    <m.div
      className={className}
      style={style}
      variants={staggerParent(stagger)}
      initial="hidden"
      animate="show"
    >
      {children}
    </m.div>
  );
}

/** A single item inside <Stagger>. */
export function StaggerItem({ children, className, style }: {
  children: ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <m.div className={className} style={style} variants={fadeUp}>
      {children}
    </m.div>
  );
}

/** One-off reveal for a standalone block. */
export function Reveal({ children, className, delay = 0, style }: {
  children: ReactNode; className?: string; delay?: number; style?: React.CSSProperties;
}) {
  return (
    <m.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
    >
      {children}
    </m.div>
  );
}

