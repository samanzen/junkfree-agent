"use client";
import { useEffect, useState } from "react";

// Shared chart interaction settings.
//
// Every chart in the platform uses Recharts with a <Tooltip>, and every one of
// them was hover-driven. There is no hover on a phone, so the numbers behind
// each point were simply unreadable there -- the chart rendered, and that was
// all you could do with it.
//
// Rather than change six charts in six ways, this returns ready-to-spread props
// so each chart adapts identically in one line, and desktop behaviour is
// unchanged by construction: on a fine pointer every value below is exactly
// what the charts already used.

/** True on touch-primary devices. Reactive, so a hybrid device switching input mode updates. */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer:coarse)");
    setCoarse(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return coarse;
}

/**
 * The settings themselves, as a pure function of pointer type, so the
 * desktop-unchanged guarantee can be asserted directly in tests rather than
 * inferred from a hook.
 */
export function chartSettings(coarse: boolean) {
  return {
    coarse,
    /**
     * Tap to inspect a point on touch, hover on desktop. This is the single
     * change that makes charts usable on a phone at all.
     */
    tooltip: {
      trigger: (coarse ? "click" : "hover") as "click" | "hover",
      // A wider hit area matters more when the pointer is a fingertip.
      ...(coarse ? { allowEscapeViewBox: { x: false, y: true } } : {}),
    },
    /**
     * Wider minimum gap between ticks on narrow screens so date labels thin
     * themselves out instead of overlapping into an unreadable smear.
     * Recharts drops ticks that would violate the gap.
     */
    xAxis: {
      minTickGap: coarse ? 32 : 8,
      tickMargin: coarse ? 8 : 4,
      interval: "preserveStartEnd" as const,
    },
    /** A fingertip needs a larger target than a mouse cursor. */
    activeDot: { r: coarse ? 6 : 4 },
    /** Legends wrap rather than clip when space is tight. */
    legend: coarse ? { wrapperStyle: { fontSize: 11, paddingTop: 4 } } : {},
  };
}

export function useChartTouch() {
  return chartSettings(useCoarsePointer());
}
