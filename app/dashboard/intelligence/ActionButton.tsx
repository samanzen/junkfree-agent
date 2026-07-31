"use client";
import { useState } from "react";
import { authedFetch } from "@/lib/authedFetch";

export type ActionType =
  | "improve_content" | "fix_meta" | "rewrite_page"
  | "generate_faq" | "build_backlinks" | "boost_page1" | "track_keyword";

type Props = {
  action: ActionType;
  brandId: string;
  payload?: Record<string, unknown>;
  label: string;
  variant?: "primary" | "ghost" | "teal";
  onDone?: () => void;
};

export default function ActionButton({ action, brandId, payload = {}, label, variant = "primary", onDone }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function run() {
    setState("loading");
    try {
      const res = await authedFetch("/api/intelligence/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, brand_id: brandId, payload }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Action failed");
      setState("done");
      setMsg("Queued ✓");
      setTimeout(() => { setState("idle"); setMsg(""); onDone?.(); }, 3000);
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Failed");
      setTimeout(() => { setState("idle"); setMsg(""); }, 4000);
    }
  }

  const base: React.CSSProperties = {
    border: 0, borderRadius: 8, padding: "7px 14px", fontSize: 12.5,
    fontWeight: 600, cursor: state === "loading" ? "default" : "pointer",
    fontFamily: "inherit", transition: "all .15s", display: "inline-flex",
    alignItems: "center", gap: 5, whiteSpace: "nowrap" as const,
  };
  const styles: Record<string, React.CSSProperties> = {
    primary: { ...base, background: "#6C5CE7", color: "#fff" },
    ghost:   { ...base, background: "transparent", color: "#6C5CE7", border: "1px solid rgba(108,92,231,.3)" },
    teal:    { ...base, background: "#00B894", color: "#fff" },
    done:    { ...base, background: "#00B894", color: "#fff" },
    error:   { ...base, background: "#FF6B6B", color: "#fff" },
  };

  const s = state === "done" ? "done" : state === "error" ? "error" : variant;

  return (
    <button style={styles[s]} onClick={run} disabled={state === "loading"}>
      {state === "loading" && <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .6s linear infinite" }} />}
      {state === "loading" ? "Working…" : msg || label}
    </button>
  );
}
