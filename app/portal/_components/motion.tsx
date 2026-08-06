"use client";
import { m, type Variants, type Transition } from "framer-motion";
import type { ReactNode } from "react";
import { MOTION } from "@/lib/ui/tokens";

// Shared motion vocabulary for the portal. Everything here is presentational —
// no component below changes data, props flow, or behaviour.
//
// Bundle: pages import `m` (not `motion`) and PortalShell mounts a single
// LazyMotion provider, so the animation feature set is loaded once and the
// heavy `motion` factory never ships. Reduced motion is honoured globally by
// <MotionConfig reducedMotion="user"> in PortalShell plus a CSS fallback.

/**
 * Standard easing, re-exported from the shared vocabulary in lib/ui/tokens so
 * a Framer animation and a CSS transition on the same element cannot disagree.
 * --ease-out in the stylesheets is these same control points.
 *
 * Kept as a named export because 17 files already import EASE from here; this
 * makes it one value with one definition rather than two that happen to match.
 */
export const EASE: Transition["ease"] = MOTION.ease;

/** Duration steps, so pages reference a named step rather than a magic number. */
export const DUR = {
  fast: MOTION.fast,
  base: MOTION.base,
  surface: MOTION.surface,
  entrance: MOTION.entrance,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } },
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
      transition={{ duration: 0.42, ease: EASE, delay }}
    >
      {children}
    </m.div>
  );
}

