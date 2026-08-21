/**
 * Admin customer-preview brand selection helpers.
 *
 * Selected brand survives hard refresh via:
 * 1. `?brand=<uuid>` in the URL (preferred, shareable)
 * 2. sessionStorage fallback when the query param is missing
 *
 * Customer accounts are locked to their own brand_id — these helpers only
 * affect admin "Previewing the customer experience" mode.
 */

export const PORTAL_PREVIEW_BRAND_KEY = "portal_preview_brand_id";

const BRAND_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBrandId(value: string | null | undefined): value is string {
  return typeof value === "string" && BRAND_ID_RE.test(value);
}

/** Stamp `?brand=` onto an internal portal path so nav / hard refresh keep the preview. */
export function withPortalBrand(href: string, brandId: string | null | undefined): string {
  if (!brandId || typeof brandId !== "string") return href;
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  try {
    const url = new URL(href, "http://portal.local");
    url.searchParams.set("brand", brandId);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

export function readStoredPreviewBrandId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(PORTAL_PREVIEW_BRAND_KEY);
    return isBrandId(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredPreviewBrandId(brandId: string): void {
  if (typeof window === "undefined" || !isBrandId(brandId)) return;
  try {
    sessionStorage.setItem(PORTAL_PREVIEW_BRAND_KEY, brandId);
  } catch {
    /* private mode / quota — ignore */
  }
}

export function clearStoredPreviewBrandId(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PORTAL_PREVIEW_BRAND_KEY);
  } catch {
    /* ignore */
  }
}

/** Ensure `?brand=` is present in the address bar without a full navigation. */
export function syncBrandQueryParam(brandId: string): void {
  if (typeof window === "undefined" || !isBrandId(brandId)) return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("brand") === brandId) return;
    url.searchParams.set("brand", brandId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}
