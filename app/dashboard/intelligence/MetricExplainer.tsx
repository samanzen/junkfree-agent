"use client";
import { useRef, useState } from "react";
import { useDialog } from "@/lib/ui/useDialog";

const EXPLANATIONS: Record<string, { label: string; explain: string }> = {
  avg_position:    { label: "Avg. Position",    explain: "Your average Google ranking across all tracked keywords. Position 1 is the top result. Below 20 means page 2 or deeper — most clicks go to the top 10." },
  top_3:           { label: "Top 3",            explain: "Keywords where you rank in the top 3 results. These get the most clicks — roughly 28%, 15%, and 11% of all searchers respectively." },
  top_10:          { label: "Top 10 (Page 1)",  explain: "Keywords on the first page of Google. Studies show 91% of clicks go to page 1 results, so being here is critical for traffic." },
  top_20:          { label: "Top 20",           explain: "Keywords on page 1 or 2. Page 2 gets very little traffic, but keywords here are candidates for a quick push onto page 1." },
  striking_dist:   { label: "Striking Distance",explain: "Keywords ranking 5–20 that could realistically reach page 1 with targeted content or a meta update. These are your fastest wins." },
  difficulty:      { label: "Keyword Difficulty",explain: "How competitive it is to rank for this keyword based on who currently ranks. 0–30 = achievable. 31–60 = competitive. 61–100 = very hard without significant authority." },
  ai_score:        { label: "AI Opportunity",   explain: "Our AI scored this keyword specifically for your business based on: local relevance, commercial intent, current ranking, and how achievable an improvement is. High score = high priority." },
  ctr:             { label: "CTR",              explain: "Click-through rate: of all people who saw your site in Google, what percentage clicked. Under 2% usually means the title or description needs updating." },
  search_intent:   { label: "Search Intent",    explain: "What searchers are trying to do. Commercial intent (comparing options, looking to hire) is most valuable for service businesses. Informational intent (just researching) brings visitors who may not be ready to buy." },
  revenue_impact:  { label: "Revenue Opportunity",explain: "Estimated monthly revenue if this keyword reached position 1, calculated from your average job value and conversion rates. Only shown when those rates are configured in Settings." },
};

type Props = { metric: keyof typeof EXPLANATIONS };

export default function MetricExplainer({ metric }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  // Non-modal: Escape closes and focus returns to the "?" button, but focus is
  // not trapped and the page is not scroll-locked — this is a hint popover, not
  // a dialog that owns the screen.
  const popRef = useDialog<HTMLDivElement>({
    open, onClose: () => setOpen(false), restoreTo: btnRef, modal: false,
  });
  const info = EXPLANATIONS[metric];
  if (!info) return null;

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`What is ${info.label}?`}
        data-touch="inline"
        style={{ background: "transparent", border: 0, cursor: "pointer", color: "#B2BAC8", fontSize: 13, padding: "0 2px", lineHeight: 1 }}
      >?</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 49 }} />
          <div ref={popRef} role="dialog" aria-label={info.label} style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            zIndex: 50, background: "#fff", border: "1px solid #E7EAF0", borderRadius: 12,
            padding: 14, width: 260, boxShadow: "0 8px 30px rgba(16,24,40,.12)", marginTop: 6,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1A2030", marginBottom: 6 }}>{info.label}</div>
            <div style={{ fontSize: 12.5, color: "#4A5568", lineHeight: 1.55 }}>{info.explain}</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close explanation"
              data-touch="inline"
              style={{ position: "absolute", top: 6, right: 8, cursor: "pointer", color: "#B2BAC8", fontSize: 14, background: "none", border: 0, padding: 4, lineHeight: 1 }}
            >✕</button>
          </div>
        </>
      )}
    </span>
  );
}
