"use client";
import { useEffect } from "react";
import { m, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

// Spring-driven counter. Renders an em-dash for null so "no data" stays
// visually distinct from zero — same contract the portal has used throughout.
export default function AnimatedNumber({
  value, decimals = 0, suffix = "",
}: {
  value: number | null | undefined;
  decimals?: number;
  suffix?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.6 });
  const text = useTransform(spring, (n) =>
    n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
  );

  useEffect(() => {
    if (value == null) return;
    if (reduce) mv.jump(value);
    else mv.set(value);
  }, [value, mv, reduce]);

  if (value == null) return <>—</>;
  return <m.span>{text}</m.span>;
}
