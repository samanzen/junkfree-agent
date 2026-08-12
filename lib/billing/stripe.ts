// Stripe billing scaffolding — env-gated. No live charges without keys.
// When STRIPE_SECRET_KEY + STRIPE_PRICE_* are set, the portal can open Checkout.
// Until then, isStripeConfigured() is false and UI stays trial / managed.

export type StripePlanKey = "founding" | "growth";

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_FOUNDING &&
      process.env.STRIPE_PRICE_GROWTH &&
      process.env.NEXT_PUBLIC_SITE_URL
  );
}

export function stripePriceId(plan: StripePlanKey): string | null {
  if (plan === "founding") return process.env.STRIPE_PRICE_FOUNDING || null;
  if (plan === "growth") return process.env.STRIPE_PRICE_GROWTH || null;
  return null;
}

export function stripePublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
}

/**
 * Create a Checkout Session URL. Returns null when Stripe is not configured.
 * Callers must not invent a fake checkout — surface managed billing instead.
 */
export async function createCheckoutSessionUrl(opts: {
  plan: StripePlanKey;
  brandId: string;
  customerEmail?: string | null;
  successPath?: string;
  cancelPath?: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isStripeConfigured()) {
    return { ok: false, error: "Self-serve billing is not configured yet." };
  }
  const price = stripePriceId(opts.plan);
  const secret = process.env.STRIPE_SECRET_KEY!;
  const site = process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/+$/, "");
  if (!price) return { ok: false, error: "Unknown plan." };

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", `${site}${opts.successPath || "/portal/billing?checkout=success"}`);
  params.set("cancel_url", `${site}${opts.cancelPath || "/portal/billing?checkout=cancel"}`);
  params.set("line_items[0][price]", price);
  params.set("line_items[0][quantity]", "1");
  params.set("client_reference_id", opts.brandId);
  params.set("metadata[brand_id]", opts.brandId);
  params.set("metadata[plan]", opts.plan);
  if (opts.customerEmail) params.set("customer_email", opts.customerEmail);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!res.ok || !data.url) {
    return { ok: false, error: data.error?.message || `Stripe Checkout failed (${res.status}).` };
  }
  return { ok: true, url: data.url };
}
