// Google Business Profile write helpers — local posts + review replies.
//
// Listing already lives in lib/google/registry.ts. This module is the execute
// side: push an approved draft to Google when the brand has a connected
// location (brands.gbp_location_id). Every call degrades cleanly on quota /
// missing approval (429) the same way listBusinessLocations does.

import { accessTokenFor } from "./tokens";
import { readGoogle } from "./store";

export type GbpWriteResult =
  | { ok: true; remoteName: string }
  | { ok: false; error: string; retryable: boolean };

/** Turn `locations/123` into the v4 parent `accounts/A/locations/L`. */
export async function resolveLocationParent(
  accessToken: string,
  locationId: string
): Promise<string | null> {
  // Already a full parent path.
  if (locationId.startsWith("accounts/") && locationId.includes("/locations/")) {
    return locationId;
  }

  const short = locationId.replace(/^locations\//, "");
  const accRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!accRes.ok) {
    throw new Error(`accounts ${accRes.status}: ${await accRes.text()}`);
  }
  const accounts =
    ((await accRes.json()) as { accounts?: { name?: string }[] }).accounts || [];

  for (const acc of accounts) {
    if (!acc.name) continue;
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations` +
        `?readMask=name&pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!locRes.ok) continue;
    const locs =
      ((await locRes.json()) as { locations?: { name?: string }[] }).locations || [];
    for ( const l of locs) {
      if (!l.name) continue;
      const locShort = l.name.replace(/^locations\//, "");
      if (l.name === locationId || locShort === short || l.name.endsWith(`/${short}`)) {
        // v4 localPosts parent uses accounts/{a}/locations/{l}
        const locPart = l.name.includes("/") ? l.name.split("/").pop() : l.name;
        return `${acc.name}/locations/${locPart}`;
      }
    }
  }
  return null;
}

export async function publishGbpLocalPost(opts: {
  brandId: string;
  locationId: string;
  title?: string | null;
  body: string;
  cta?: string | null;
}): Promise<GbpWriteResult> {
  const google = await readGoogle(opts.brandId);
  const accountId =
    google.selections.google_business_profile?.accountId ||
    google.accounts[google.accounts.length - 1]?.id;
  if (!accountId) {
    return { ok: false, error: "Google Business Profile is not connected.", retryable: false };
  }

  let accessToken: string;
  try {
    accessToken = await accessTokenFor(opts.brandId, accountId);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not refresh Google access.",
      retryable: false,
    };
  }

  let parent: string | null;
  try {
    parent = await resolveLocationParent(accessToken, opts.locationId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const quota = /\b429\b|RESOURCE_EXHAUSTED|Quota/i.test(msg);
    return {
      ok: false,
      error: quota
        ? "Google has not enabled Business Profile API access for this project yet."
        : msg,
      retryable: quota,
    };
  }
  if (!parent) {
    return { ok: false, error: "Could not resolve that Business Profile location.", retryable: false };
  }

  const summary = [opts.title, opts.body, opts.cta].filter(Boolean).join("\n\n").slice(0, 1500);
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${parent}/localPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      languageCode: "en-US",
      summary,
      topicType: "STANDARD",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      error: `GBP localPosts ${res.status}: ${text.slice(0, 280)}`,
      retryable: res.status >= 500 || res.status === 429,
    };
  }
  const data = (await res.json()) as { name?: string };
  return { ok: true, remoteName: data.name || `${parent}/localPosts/unknown` };
}

export async function publishGbpReviewReply(opts: {
  brandId: string;
  /** Full review resource name, e.g. accounts/A/locations/L/reviews/R */
  reviewName: string;
  comment: string;
}): Promise<GbpWriteResult> {
  const google = await readGoogle(opts.brandId);
  const accountId =
    google.selections.google_business_profile?.accountId ||
    google.accounts[google.accounts.length - 1]?.id;
  if (!accountId) {
    return { ok: false, error: "Google Business Profile is not connected.", retryable: false };
  }

  let accessToken: string;
  try {
    accessToken = await accessTokenFor(opts.brandId, accountId);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not refresh Google access.",
      retryable: false,
    };
  }

  const res = await fetch(`https://mybusiness.googleapis.com/v4/${opts.reviewName}/reply`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment: opts.comment.slice(0, 4096) }),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      error: `GBP review reply ${res.status}: ${text.slice(0, 280)}`,
      retryable: res.status >= 500 || res.status === 429,
    };
  }
  return { ok: true, remoteName: `${opts.reviewName}/reply` };
}
