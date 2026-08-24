"use client";

import { useState } from "react";
import Field from "@/app/_components/Field";

/** Local interest capture until the waitlist backend exists. */
export default function NotifyInterestForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <form
      className="wb-notify"
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
      {done ? (
        <p className="wb-notify-done">Thanks — we&apos;ll be in touch.</p>
      ) : (
        <>
          <Field
            label="Notify me when this opens"
            type="email"
            name="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputClassName="wb-notify-input"
          />
          <button type="submit" className="wb-notify-btn">
            Notify Me
          </button>
        </>
      )}
    </form>
  );
}
