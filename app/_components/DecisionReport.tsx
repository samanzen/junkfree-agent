"use client";
import { useRef } from "react";
import { useDialog } from "@/lib/ui/useDialog";
import { buildDecisionReport, type DecisionWhyInput } from "@/lib/recommendations/preview";

type Props = {
  open: boolean;
  onClose: () => void;
  input: DecisionWhyInput | null;
};

export default function DecisionReport({ open, onClose, input }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useDialog<HTMLDivElement>({ open, onClose, modal: true });
  if (!open || !input) return null;
  const report = buildDecisionReport(input);

  return (
    <div className="dr-layer">
      <style>{DR_CSS}</style>
      <div className="dr-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="dr-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Why: ${report.title}`}
      >
        <header className="dr-top">
          <div>
            <div className="dr-kicker">Decision report</div>
            <h2 className="dr-title">{report.title}</h2>
          </div>
          <button ref={closeRef} type="button" className="dr-x" onClick={onClose} aria-label="Close report">✕</button>
        </header>
        <div className="dr-body">
          {report.sections.map((s) => (
            <section key={s.heading} className="dr-sec">
              <h3>{s.heading}</h3>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

const DR_CSS = `
.dr-layer { position:fixed; inset:0; z-index:330; display:flex; align-items:stretch; justify-content:center; padding:18px; pointer-events:none; }
.dr-scrim { position:absolute; inset:0; background:rgba(16,24,40,.55); pointer-events:auto; }
.dr-sheet { position:relative; pointer-events:auto; background:#fff; color:#1A2030; width:min(720px,100%); max-height:100%; border-radius:16px; display:flex; flex-direction:column; box-shadow:0 24px 80px rgba(16,24,40,.28); overflow:hidden; }
.dr-top { display:flex; justify-content:space-between; gap:12px; padding:16px 18px; border-bottom:1px solid #E7EAF0; }
.dr-kicker { font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#6C5CE7; }
.dr-title { font-size:18px; font-weight:700; letter-spacing:-.02em; margin:4px 0 0; }
.dr-x { width:36px; height:36px; border:1px solid #E7EAF0; background:#fff; border-radius:8px; cursor:pointer; color:#6B768D; flex-shrink:0; }
.dr-body { overflow:auto; padding:8px 22px 28px; }
.dr-sec { padding:16px 0; border-top:1px solid #F0F2F5; }
.dr-sec:first-child { border-top:0; }
.dr-sec h3 { margin:0 0 8px; font-size:13px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#6C5CE7; }
.dr-sec p { margin:0; font-size:14.5px; line-height:1.65; color:#3A4256; white-space:pre-wrap; }
@media (max-width:640px) {
  .dr-layer { padding:0; }
  .dr-sheet { border-radius:0; }
}
`;
