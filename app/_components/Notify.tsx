"use client";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDialog } from "@/lib/ui/useDialog";

// Toasts and confirmations for both frontends.
//
// Replaces 24 alert() calls and 1 window.confirm(). Those are blocking, cannot
// be styled or themed, stack badly, and on mobile render as an OS dialog that
// looks nothing like the product around it.
//
// Mounted once at the root layout so /dashboard and /portal share one overlay
// stack -- neither tree needs its own, and a toast raised from a shared
// component (ExecutionPanel, ApprovalCard) works identically in both.
//
// Theming note: toasts deliberately use one high-contrast dark surface in both
// light and dark mode, the way Linear and Vercel do. The portal's theme toggle
// writes data-theme onto its own .portal element, not the document root, so a
// root-mounted overlay cannot observe it; a fixed treatment is both cohesive
// and always legible rather than occasionally wrong. The confirm dialog, which
// is a full surface rather than a passing notification, follows the OS setting.

export type ToastKind = "success" | "error" | "warning" | "info";

type Toast = { id: string; kind: ToastKind; title: string; detail?: string; duration: number };

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm action as destructive. */
  danger?: boolean;
};

type NotifyApi = {
  toast: (kind: ToastKind, title: string, detail?: string) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  warning: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  dismiss: (id: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const NotifyContext = createContext<NotifyApi | null>(null);

const DEFAULT_MS: Record<ToastKind, number> = {
  // Errors stay until dismissed: a failure the user missed is a failure they
  // will report as "nothing happened".
  error: 0,
  warning: 9000,
  success: 5000,
  info: 6000,
};

export function useNotify(): NotifyApi {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error("useNotify must be used within NotifyProvider");
  return ctx;
}

/** Convenience alias for the common case. */
export function useToast() {
  const { success, error, warning, info, toast, dismiss } = useNotify();
  return { success, error, warning, info, toast, dismiss };
}

export function useConfirm() {
  return useNotify().confirm;
}

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);
  const seq = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const id = `t${++seq.current}`;
    setToasts((list) => {
      // Cap the stack so a loop of failures cannot cover the screen.
      const next = [...list, { id, kind, title, detail, duration: DEFAULT_MS[kind] }];
      return next.slice(-4);
    });
  }, []);

  const api = useMemo<NotifyApi>(() => ({
    toast,
    success: (t, d) => toast("success", t, d),
    error: (t, d) => toast("error", t, d),
    warning: (t, d) => toast("warning", t, d),
    info: (t, d) => toast("info", t, d),
    dismiss,
    confirm: (opts) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
  }), [toast, dismiss]);

  return (
    <NotifyContext.Provider value={api}>
      {children}
      <style dangerouslySetInnerHTML={{ __html: NOTIFY_CSS }} />
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {confirmState && (
        <ConfirmDialog
          {...confirmState}
          onResolve={(v) => { confirmState.resolve(v); setConfirmState(null); }}
        />
      )}
    </NotifyContext.Provider>
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <>
      {/* Two regions: errors and warnings interrupt, the rest wait their turn.
          Both live outside the visual stack so announcements are not tied to
          the animation. */}
      <div className="nt-sr" role="alert" aria-live="assertive" aria-atomic="false">
        {toasts.filter((t) => t.kind === "error" || t.kind === "warning")
          .map((t) => <div key={t.id}>{t.title}{t.detail ? `. ${t.detail}` : ""}</div>)}
      </div>
      <div className="nt-sr" role="status" aria-live="polite" aria-atomic="false">
        {toasts.filter((t) => t.kind === "success" || t.kind === "info")
          .map((t) => <div key={t.id}>{t.title}{t.detail ? `. ${t.detail}` : ""}</div>)}
      </div>

      <div className="nt-viewport">
        {toasts.map((t) => <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />)}
      </div>
    </>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);

  const close = useCallback(() => {
    setLeaving(true);
    // Let the exit animation finish before unmounting.
    setTimeout(() => onDismiss(toast.id), 180);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    if (!toast.duration || paused) return;
    const timer = setTimeout(close, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, paused, close]);

  return (
    <div
      className={`nt-toast nt-${toast.kind} ${leaving ? "nt-leaving" : ""}`}
      // Hovering or focusing to read a long message must not race the timer.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="nt-icon" aria-hidden="true"><ToastIcon kind={toast.kind} /></span>
      <div className="nt-body">
        <div className="nt-title">{toast.title}</div>
        {toast.detail && <div className="nt-detail">{toast.detail}</div>}
      </div>
      <button className="nt-close" onClick={close} aria-label="Dismiss notification">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "success") return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
  if (kind === "error") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>;
  if (kind === "warning") return <svg {...common}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 7.5v.01" /></svg>;
}

// ── Confirm ─────────────────────────────────────────────────────────────────

function ConfirmDialog({
  title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger, onResolve,
}: ConfirmOptions & { onResolve: (v: boolean) => void }) {
  const titleId = useId();
  const bodyId = useId();
  // Same shared dialog behaviour as every other overlay: Escape, focus trap,
  // focus restore, scroll lock. Escape resolves false, matching what dismissing
  // a native confirm() did.
  const ref = useDialog<HTMLDivElement>({ open: true, onClose: () => onResolve(false) });

  return (
    <div className="nt-confirm-root">
      <div className="nt-scrim" onClick={() => onResolve(false)} aria-hidden="true" />
      <div
        ref={ref}
        className="nt-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
      >
        <h2 id={titleId} className="nt-confirm-title">{title}</h2>
        {body && <p id={bodyId} className="nt-confirm-body">{body}</p>}
        <div className="nt-confirm-actions">
          <button className="nt-btn nt-btn-ghost" onClick={() => onResolve(false)}>{cancelLabel}</button>
          <button
            className={`nt-btn ${danger ? "nt-btn-danger" : "nt-btn-primary"}`}
            onClick={() => onResolve(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const NOTIFY_CSS = `
.nt-sr { position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap; border:0; }

.nt-viewport {
  position:fixed; z-index:9000; display:flex; flex-direction:column; gap:9px;
  right:16px; bottom:16px; width:min(380px, calc(100vw - 32px));
  pointer-events:none;
}
/* Above the bottom nav, and clear of the home indicator. */
@media (max-width:899px) {
  .nt-viewport {
    right:12px; left:12px; width:auto;
    bottom:calc(78px + env(safe-area-inset-bottom));
  }
}

.nt-toast {
  pointer-events:auto;
  display:flex; align-items:flex-start; gap:11px;
  background:#16181D; color:#F2F4F7;
  border:1px solid rgba(255,255,255,.10); border-radius:12px;
  padding:12px 12px 12px 14px;
  box-shadow:0 12px 32px rgba(0,0,0,.30), 0 2px 8px rgba(0,0,0,.20);
  animation:ntIn .22s cubic-bezier(.32,.72,0,1);
  font-family:var(--font-sans);
}
.nt-toast.nt-leaving { animation:ntOut .18s ease forwards; }
@keyframes ntIn  { from { opacity:0; transform:translateY(10px) scale(.98); } to { opacity:1; transform:none; } }
@keyframes ntOut { to { opacity:0; transform:translateY(6px) scale(.98); } }

.nt-icon { flex:none; display:flex; margin-top:1px; }
.nt-success .nt-icon { color:#4ADE80; }
.nt-error   .nt-icon { color:#FB7185; }
.nt-warning .nt-icon { color:#FBBF24; }
.nt-info    .nt-icon { color:#7DD3FC; }

.nt-body { flex:1; min-width:0; }
.nt-title { font-size:13.5px; font-weight:600; letter-spacing:-.01em; line-height:1.4; }
.nt-detail { font-size:12.5px; line-height:1.5; color:#A8B0BD; margin-top:2px; overflow-wrap:anywhere; }

.nt-close {
  flex:none; background:none; border:0; cursor:pointer; color:#8A93A6;
  width:26px; height:26px; border-radius:7px; display:grid; place-items:center;
  transition:color .15s, background .15s;
}
.nt-close:hover { color:#F2F4F7; background:rgba(255,255,255,.08); }
.nt-close:focus-visible { outline:2px solid #7DD3FC; outline-offset:1px; }
@media (pointer:coarse) { .nt-close { width:40px; height:40px; } }

/* ── Confirm ── */
.nt-confirm-root { position:fixed; inset:0; z-index:9100; }
.nt-scrim { position:absolute; inset:0; background:rgba(8,10,14,.55); backdrop-filter:blur(2px); }
.nt-confirm {
  position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:min(420px, calc(100vw - 32px));
  background:#fff; color:#1A2030;
  border-radius:16px; padding:22px;
  box-shadow:0 24px 64px rgba(0,0,0,.28);
  font-family:var(--font-sans);
  animation:ntIn .2s cubic-bezier(.32,.72,0,1);
}
.nt-confirm-title { font-size:16.5px; font-weight:650; letter-spacing:-.02em; margin:0 0 7px; }
.nt-confirm-body { font-size:13.5px; line-height:1.6; color:#4A5568; margin:0 0 20px; overflow-wrap:anywhere; }
.nt-confirm-actions { display:flex; gap:9px; justify-content:flex-end; flex-wrap:wrap; }
.nt-btn {
  font-family:inherit; font-size:13.5px; font-weight:560; cursor:pointer;
  padding:10px 17px; border-radius:10px; border:1px solid transparent;
  min-height:42px; transition:background .15s, border-color .15s, color .15s;
}
@media (pointer:coarse) { .nt-btn { min-height:44px; flex:1; } }
.nt-btn:focus-visible { outline:2px solid #6C5CE7; outline-offset:2px; }
.nt-btn-ghost { background:#fff; border-color:#E2E6EE; color:#4A5568; }
.nt-btn-ghost:hover { border-color:#C6CEDA; color:#1A2030; }
.nt-btn-primary { background:#5B5FD6; color:#fff; }
.nt-btn-primary:hover { background:#4E52C4; }
.nt-btn-danger { background:#D64545; color:#fff; }
.nt-btn-danger:hover { background:#C13A3A; }

@media (prefers-color-scheme: dark) {
  .nt-confirm { background:#161A21; color:#E8ECF2; box-shadow:0 24px 64px rgba(0,0,0,.5); }
  .nt-confirm-body { color:#A3ACBA; }
  .nt-btn-ghost { background:transparent; border-color:#2C333E; color:#A3ACBA; }
  .nt-btn-ghost:hover { border-color:#3D4552; color:#E8ECF2; }
}

/* No prefers-reduced-motion block here on purpose: GLOBAL_CSS in
   lib/ui/tokens.ts already neutralises animation on every element with
   !important, so a second declaration would be a duplicate of a rule that
   already covers these. */
`;
