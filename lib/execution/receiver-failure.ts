// Customer-facing copy when a coded-site receiver check or publish fails.
//
// The adapter used to surface "Receiver returned HTTP 405" — a status code
// that means nothing to the person connecting their site. The usual cause is
// that the address is the public website (a static/SPA shell), not the
// deployed receiver.

export function receiverFailureCopy(status: number, body: unknown): string {
  const text = typeof body === "string" ? body : "";
  const looksLikePublicSite =
    status === 405 ||
    status === 404 ||
    /<!doctype html|<html[\s>]/i.test(text);

  if (looksLikePublicSite) {
    return "That address is your public website, not the receiver. Add the code to your site, deploy it, then connect.";
  }
  if (status === 401 || status === 403) {
    return "The secret on your site doesn't match the one on this page. Copy the code again, deploy it, then connect.";
  }
  if (status >= 500) {
    return "Your site answered, but something went wrong on its side. Try again in a moment.";
  }
  if (status === 0) {
    return "We couldn't reach that address. Check it is https and that the code is live.";
  }
  return "We couldn't reach the receiver on your site. Check the address and that the code is live.";
}
