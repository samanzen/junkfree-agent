import type { ReactNode } from "react";
import { PortalAuthProvider } from "@/lib/portalAuth";
import PortalShell from "./PortalShell";

// Root layout for the entire customer Portal (Dashboard 2.0). Every /portal/*
// route shares one auth resolution (lib/portalAuth) and one shell (nav +
// topbar). The admin dashboard (app/dashboard) is a completely separate tree
// and is untouched by anything here.
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalAuthProvider>
      <PortalShell>{children}</PortalShell>
    </PortalAuthProvider>
  );
}
