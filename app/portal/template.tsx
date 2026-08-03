"use client";
import { m } from "framer-motion";
import { EASE } from "./_components/motion";

// Next.js re-mounts a template on every navigation, so this gives each portal
// page a consistent enter transition without any routing or data changes.
// Purely presentational — it renders children untouched.
export default function PortalTemplate({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: EASE }}
    >
      {children}
    </m.div>
  );
}
