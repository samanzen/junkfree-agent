"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "./supabaseBrowser";
import { authedFetch } from "./authedFetch";
import {
  clearStoredPreviewBrandId,
  isBrandId,
  readStoredPreviewBrandId,
  syncBrandQueryParam,
  writeStoredPreviewBrandId,
} from "./portalBrand";

export type PortalBrand = {
  id: string;
  name: string;
  slug: string;
  site_url: string;
  service_area?: string;
  services?: string;
  business_model?: string;
  gsc_property?: string | null;
  gbp_location_id?: string | null;
  owner_email?: string | null;
  auto_publish_meta?: boolean;
  primary_writer?: string | null;
  proxy_namespace?: string | null;
  proxy_nav_link_dismissed_at?: string | null;
  site_capabilities?: Record<string, { state?: string } | undefined> | null;
};

type PortalAuthState = {
  loading: boolean;
  error: string;
  isAdmin: boolean;
  brand: PortalBrand | null;
  signOut: () => void;
};

const PortalAuthContext = createContext<PortalAuthState | null>(null);

export {
  PORTAL_PREVIEW_BRAND_KEY,
  withPortalBrand,
  syncBrandQueryParam,
} from "./portalBrand";

// Resolves once per /portal session: who's signed in, whether they're an
// admin previewing the customer view, and which single brand this instance
// of the portal is scoped to. Customers are always locked to their own
// brand_id. Admins take ?brand=, then sessionStorage, then the first active
// brand — and keep ?brand= in the URL so refresh does not jump tenants.
export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const brandParam = searchParams.get("brand");
  const [state, setState] = useState<Omit<PortalAuthState, "signOut">>({
    loading: true, error: "", isAdmin: false, brand: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (!token) { router.push("/login"); return; }

      const me = await (await authedFetch("/api/me")).json();
      const isAdmin = me.role === "admin";

      if (!me.brand_id && !isAdmin) {
        if (!cancelled) {
          setState({ loading: false, error: "No brand linked to your account. Please contact support.", isAdmin, brand: null });
        }
        return;
      }

      let brandId: string | null = null;

      if (me.brand_id) {
        // Customers (and admins who happen to own a brand) stay locked to that row.
        // URL ?brand= cannot switch a customer onto another tenant.
        brandId = me.brand_id;
      } else if (isAdmin) {
        const urlBrand = new URLSearchParams(window.location.search).get("brand");
        brandId = isBrandId(urlBrand) ? urlBrand : readStoredPreviewBrandId();
        if (!brandId) {
          const platform = await (await authedFetch("/api/platform")).json();
          brandId = platform.brands?.[0]?.id ?? null;
        }
      }

      if (!brandId) {
        if (!cancelled) {
          setState({ loading: false, error: "No active brands found.", isAdmin, brand: null });
        }
        return;
      }

      if (isAdmin && !me.brand_id) {
        writeStoredPreviewBrandId(brandId);
        syncBrandQueryParam(brandId);
      }

      const platform = await (await authedFetch(`/api/platform?brand=${brandId}`)).json();
      if (cancelled) return;
      const brand = platform.brands?.[0] || null;
      if (!brand) {
        setState({ loading: false, error: "Brand not found.", isAdmin, brand: null });
        return;
      }
      setState({ loading: false, error: "", isAdmin, brand });
    })().catch((e) => {
      if (!cancelled) setState({ loading: false, error: String(e), isAdmin: false, brand: null });
    });

    return () => { cancelled = true; };
  // Intentionally once on mount — brand is sticky for the session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ?brand= stamped when pathname or search changes without remounting
  // (sidebar nav, settings tabs, address-bar edits that drop the param).
  useEffect(() => {
    if (!state.isAdmin || !state.brand?.id) return;
    if (brandParam !== state.brand.id) syncBrandQueryParam(state.brand.id);
    writeStoredPreviewBrandId(state.brand.id);
  }, [pathname, brandParam, state.isAdmin, state.brand?.id]);

  const signOut = () => {
    clearStoredPreviewBrandId();
    supabaseBrowser().auth.signOut().then(() => router.push("/login"));
  };

  return (
    <PortalAuthContext.Provider value={{ ...state, signOut }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return ctx;
}
