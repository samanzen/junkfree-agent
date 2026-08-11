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
  services?: string;
  business_model?: string;
  gsc_property?: string | null;
  gbp_location_id?: string | null;
  owner_email?: string | null;
  auto_publish_meta?: boolean;
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
    // Every path below MUST end in setState. This block previously had no
    // try/catch, so a single rejected await — a non-OK response, or .json() on
    // an HTML error page — skipped setState entirely and left loading:true
    // FOREVER. The portal then showed skeletons indefinitely with no error and
    // no way out. Observed live as an admin with brand_id:null.
    let cancelled = false;
    const settle = (s: Omit<PortalAuthState, "signOut">) => { if (!cancelled) setState(s); };

    /** Throws with a readable message rather than yielding undefined. */
    async function getJson(url: string) {
      const res = await authedFetch(url);
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return res.json();
    }

    (async () => {
      try {
        const { data } = await supabaseBrowser().auth.getSession();
        const token = data.session?.access_token;
        if (!token) { router.push("/login"); return; }

        const me = await getJson("/api/me");
        const isAdmin = me.role === "admin";

        if (!me.brand_id && !isAdmin) {
          settle({ loading: false, error: "No brand is linked to your account yet. Please contact your account manager.", isAdmin, brand: null });
          return;
        }

        // Tenancy is NOT relaxed here. A customer is always pinned to their own
        // brand_id. An admin may pass ?brand=, and otherwise falls back to the
        // first brand /api/platform returns — that endpoint is server-side
        // authorised, so the fallback is a permitted brand, never a guess.
        let brandId: string | null = me.brand_id || null;
        if (!brandId) {
          brandId = new URLSearchParams(window.location.search).get("brand");
          if (!brandId) {
            const platform = await getJson("/api/platform");
            brandId = platform.brands?.[0]?.id ?? null;
          }
        }
        if (!brandId) {
          settle({
            loading: false, isAdmin, brand: null,
            error: isAdmin
              ? "No brand selected. Open a customer from the admin dashboard to preview their portal."
              : "No active brands found.",
          });
          return;
        }

        const platform = await getJson(`/api/platform?brand=${brandId}`);
        const brand = platform.brands?.[0] || null;
        if (!brand) {
          settle({
            loading: false, isAdmin, brand: null,
            error: isAdmin
              ? "That brand could not be loaded. It may be inactive, or you may not have access to it."
              : "Brand not found.",
          });
          return;
        }

        settle({ loading: false, error: "", isAdmin, brand });
      } catch (e) {
        // The whole point of this catch: a failure now ENDS the loading state.
        settle({
          loading: false, isAdmin: false, brand: null,
          error: `We couldn't load your portal. ${e instanceof Error ? e.message : "Please try again."}`,
        });
      }
    })();

    return () => { cancelled = true; };
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
