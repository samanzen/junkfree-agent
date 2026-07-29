"use client";
import { useEffect, useRef, useState } from "react";

// Animates a number counting up from 0 to the target when it mounts/changes.
export default function CountUp({ value, decimals = 0, suffix = "" }: { value: number | null; decimals?: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (value == null) return;
    const start = performance.now();
    const from = 0, to = value, dur = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  if (value == null) return <>—</>;
  return <>{display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}
