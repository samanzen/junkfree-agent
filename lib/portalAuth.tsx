"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "./supabaseBrowser";
import { authedFetch } from "./authedFetch";

export type PortalBrand = {
  id: string;
  name: string;
  slug: string;
  site_url: string;
  service_area?: string;
  business_model?: string;
  gsc_property?: string | null;
};

type PortalAuthState = {
  loading: boolean;
  error: string;
  isAdmin: boolean;
  brand: PortalBrand | null;
  signOut: () => void;
};

const PortalAuthContext = createContext<PortalAuthState | null>(null);

// Resolves once per /portal session: who's signed in, whether they're an
// admin previewing the customer view, and which single brand this instance
// of the portal is scoped to. Same resolution rules the old single-page
// /portal used — customers are always locked to their own brand_id; admins
// take an explicit ?brand= (set by the dashboard's "Customer view" link) or
// fall back to the first active brand.
export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<PortalAuthState, "signOut">>({
    loading: true, error: "", isAdmin: false, brand: null,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (!token) { router.push("/login"); return; }

      const me = await (await authedFetch("/api/me")).json();
      const isAdmin = me.role === "admin";

      if (!me.brand_id && !isAdmin) {
        setState({ loading: false, error: "No brand linked to your account. Please contact support.", isAdmin, brand: null });
        return;
      }

      let brandId: string | null = me.brand_id || null;
      if (!brandId) {
        brandId = new URLSearchParams(window.location.search).get("brand");
        if (!brandId) {
          const platform = await (await authedFetch("/api/platform")).json();
          brandId = platform.brands?.[0]?.id ?? null;
        }
      }
      if (!brandId) {
        setState({ loading: false, error: "No active brands found.", isAdmin, brand: null });
        return;
      }

      const platform = await (await authedFetch(`/api/platform?brand=${brandId}`)).json();
      const brand = platform.brands?.[0] || null;
      if (!brand) {
        setState({ loading: false, error: "Brand not found.", isAdmin, brand: null });
        return;
      }

      setState({ loading: false, error: "", isAdmin, brand });
    })();
    /* eslint-disable-next-line */
  }, []);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
  }

  return (
    <PortalAuthContext.Provider value={{ ...state, signOut }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth(): PortalAuthState {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return ctx;
}
