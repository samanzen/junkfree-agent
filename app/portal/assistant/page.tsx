"use client";
import { useEffect, useRef, useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import { authedFetch } from "@/lib/authedFetch";
import PageHeader from "../_components/PageHeader";
import { IconSparkle, IconSend } from "../icons";

type Msg = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "Why did my traffic change recently?",
  "What should I publish next?",
  "How can I improve my local SEO?",
  "Which keywords are closest to page 1?",
  "Explain my ranking changes in plain English.",
  "What's the single most valuable thing I could do this week?",
];

export default function AssistantPage() {
  const { brand } = usePortalAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy || !brand) return;

    const history = messages;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const res = await authedFetch("/api/portal/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brand.id, question: q, history }),
      });
      const data = await res.json();
      if (!res.ok || !data.answer) {
        setError(data.error || "The assistant couldn't answer that. Please try again.");
      } else {
        setMessages((m) => [...m, { role: "assistant", text: data.answer }]);
      }
    } catch {
      setError("Couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!brand) return null;

  return (
    <div className="p-stack p-assistant-page">
      <PageHeader
        eyebrow="AI Assistant"
        title="Ask anything about your SEO"
        sub={`Your assistant knows ${brand.name}'s live rankings, traffic and content — ask in plain English.`}
      />

      <div className="p-chat">
        <div className="p-chat-scroll">
          {messages.length === 0 && !busy && (
            <div className="p-chat-welcome">
              <span className="p-exec-icon" style={{ width: 44, height: 44 }}><IconSparkle size={20} /></span>
              <h2 className="p-chat-welcome-title">How can I help?</h2>
              <p className="p-chat-welcome-sub">
                I can see your current rankings, traffic, keywords and published content.
                Pick a question below or ask your own.
              </p>
              <div className="p-chat-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="p-chat-suggestion" onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`p-msg ${m.role}`}>
              {m.role === "assistant" && (
                <span className="p-msg-avatar"><IconSparkle size={14} /></span>
              )}
              <div className="p-msg-bubble">{m.text}</div>
            </div>
          ))}

          {busy && (
            <div className="p-msg assistant">
              <span className="p-msg-avatar"><IconSparkle size={14} /></span>
              <div className="p-msg-bubble p-msg-typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          {error && <div className="p-chat-error">{error}</div>}
          <div ref={endRef} />
        </div>

        <form
          className="p-chat-input-row"
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
        >
          <input
            className="p-input"
            placeholder="Ask about your rankings, traffic, content…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="p-btn primary" disabled={busy || !input.trim()}>
            <IconSend size={15} /> Ask
          </button>
        </form>
      </div>
    </div>
  );
}
