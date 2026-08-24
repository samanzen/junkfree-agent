"use client";

import { useState } from "react";
import type { CapabilityReportItem } from "@/lib/website-connection/capability-report";

/**
 * Progressive capability list — summary first, details on demand.
 */
export default function CapabilityReport({
  items,
  access,
  onRecheckAccess,
  onRecheckConnection,
  busy,
}: {
  items: CapabilityReportItem[];
  access?: { weAccess: string[]; weDoNotAccess: string[] } | null;
  onRecheckAccess?: () => void;
  onRecheckConnection?: () => void;
  busy?: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="p-cap-report">
      {access && (
        <details className="p-cap-access">
          <summary>What we access</summary>
          <div className="p-cap-access-cols">
            <div>
              <div className="p-cap-access-h">We can access</div>
              <ul>
                {access.weAccess.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="p-cap-access-h">We do not access</div>
              <ul>
                {access.weDoNotAccess.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      )}

      <ul className="p-cap-list">
        {items.map((item) => {
          const open = openKey === item.key;
          return (
            <li key={item.key} className={`p-cap-item p-cap-${item.status}`}>
              <div className="p-cap-row">
                <div className="p-cap-main">
                  <span className="p-cap-label">{item.label}</span>
                  <span className={`p-cap-status p-cap-status-${item.status}`}>{item.statusLabel}</span>
                </div>
                <p className="p-cap-summary">{item.summary}</p>
                <button
                  type="button"
                  className="p-linkbtn"
                  onClick={() => setOpenKey(open ? null : item.key)}
                >
                  {open ? "Hide details" : "View details"}
                </button>
              </div>
              {open && (
                <div className="p-cap-details">
                  <p>
                    <strong>Can analyze:</strong> {item.details.canAnalyze}
                  </p>
                  <p>
                    <strong>Can publish:</strong> {item.details.canPublish}
                  </p>
                  <p>
                    <strong>Cannot do automatically:</strong> {item.details.cannotDo}
                  </p>
                  <p>
                    <strong>Reason:</strong> {item.details.reasonLabel}
                  </p>
                  {item.details.customerAction && (
                    <p>
                      <strong>What you can do:</strong> {item.details.customerAction}
                    </p>
                  )}
                  {item.details.developerAction && (
                    <p>
                      <strong>Developer instructions:</strong> {item.details.developerAction}
                    </p>
                  )}
                  {item.details.unlockHint && (
                    <p>
                      <strong>To unlock more:</strong> {item.details.unlockHint}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {(onRecheckAccess || onRecheckConnection) && (
        <div className="p-conn-actions" style={{ marginTop: 12 }}>
          {onRecheckAccess && (
            <button type="button" className="p-btn ghost" onClick={onRecheckAccess} disabled={busy}>
              <span>{busy ? "Checking…" : "Recheck Access"}</span>
            </button>
          )}
          {onRecheckConnection && (
            <button type="button" className="p-btn ghost" onClick={onRecheckConnection} disabled={busy}>
              <span>{busy ? "Checking…" : "Recheck Connection"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
