import type { ReactNode } from "react";
import { Suspense } from "react";
import { PortalAuthProvider } from "@/lib/portalAuth";
import PortalShell from "./PortalShell";

// Root layout for the entire customer Portal (Dashboard 2.0). Every /portal/*
// route shares one auth resolution (lib/portalAuth) and one shell (nav +
// topbar). The admin dashboard (app/dashboard) is a completely separate tree
// and is untouched by anything here.
//
// Suspense wraps the auth provider because it reads useSearchParams to keep
// ?brand= stamped during client navigations.
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PortalAuthProvider>
        <PortalShell>{children}</PortalShell>
      </PortalAuthProvider>
    </Suspense>
  );
}
