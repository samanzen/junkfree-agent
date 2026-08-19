"use client";
import { useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import Field from "@/app/_components/Field";

type Msg = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "What did the AI improve this period?",
  "Why did clicks change?",
  "Which keywords should we fix first?",
  "How do we compare to competitors?",
];

/** Lightweight report chat — ask the AI about what the report shows. */
export default function ReportAskBar({ brandId }: { brandId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy || !brandId) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await authedFetch("/api/portal/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          question: q,
          history: messages.slice(-6),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not get an answer");
      setMessages((m) => [...m, { role: "assistant", text: d.answer || d.text || "…" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
    setBusy(false);
  }

  return (
    <div className="rab">
      <button type="button" className="rab-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide chat" : "Ask the AI about this report"}
      </button>
      {open && (
        <div className="rab-panel">
          <p className="rab-hint">
            Agents already did the SEO work. Ask anything that looks wrong or unclear — the AI will explain in plain English.
          </p>
          {messages.length === 0 && (
            <div className="rab-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="rab-chip" onClick={() => ask(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="rab-msgs">
            {messages.map((m, i) => (
              <div key={i} className={`rab-msg ${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="rab-msg assistant">Thinking…</div>}
          </div>
          {error && <p className="rab-err">{error}</p>}
          <div className="rab-compose">
            <Field
              hideLabel
              label="Ask the AI"
              value={input}
              disabled={busy}
              placeholder="e.g. Why did impressions drop?"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask(input);
              }}
            />
            <button type="button" className="rab-send" onClick={() => ask(input)} disabled={busy || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
