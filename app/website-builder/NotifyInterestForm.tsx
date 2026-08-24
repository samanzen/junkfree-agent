"use client";

import { useState } from "react";

/** Local interest capture until the waitlist backend exists. */
export default function NotifyInterestForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        try {
          const key = "volo_website_builder_interest";
          const prev = JSON.parse(sessionStorage.getItem(key) || "[]") as string[];
          if (!prev.includes(email.trim())) {
            sessionStorage.setItem(key, JSON.stringify([...prev, email.trim()]));
          }
        } catch {
          /* ignore */
        }
        setDone(true);
      }}
    >
      <label htmlFor="wb-email" style={{ display: "block", fontSize: 13, color: "#9db5a8", marginBottom: 6 }}>
        Notify me when this opens
      </label>
      {done ? (
        <p style={{ margin: 0, color: "#3ecf8e", fontWeight: 600 }}>Thanks — we&apos;ll be in touch.</p>
      ) : (
        <>
          <input
            id="wb-email"
            name="email"
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(0,0,0,0.25)",
              color: "#fff",
              fontSize: 15,
              marginBottom: 14,
            }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "13px 16px",
              border: 0,
              borderRadius: 10,
              background: "#3ecf8e",
              color: "#0b1612",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Notify Me
          </button>
        </>
      )}
    </form>
  );
}
