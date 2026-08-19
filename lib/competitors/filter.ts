// Competitor discovery denylist.
//
// DataForSEO's competitors_domain endpoint ranks any domain that overlaps
// keywords — for local service brands that often includes Facebook pages,
// Yelp, Reddit threads, YouTube, and directories. Those are SERP noise, not
// businesses the customer should track as rivals.
//
// One shared filter so Labs discovery, the Discover button, and any future
// research agent cannot invent different rules.

const SOCIAL_AND_DIRECTORY_HOSTS = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "reddit.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "pinterest.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "nextdoor.com",
  "yelp.com",
  "yelp.ca",
  "tripadvisor.com",
  "tripadvisor.ca",
  "homestars.com",
  "yellowpages.ca",
  "yellowpages.com",
  "yp.ca",
  "bbb.org",
  "angi.com",
  "angieslist.com",
  "thumbtack.com",
  "houzz.com",
  "craigslist.org",
  "quora.com",
  "medium.com",
  "wikipedia.org",
  "wikidata.org",
  "apple.com",
  "maps.google.com",
  "google.com",
  "bing.com",
  "duckduckgo.com",
] as const;

/** Normalize to registrable-ish host without scheme/www/path. */
export function normalizeCompetitorDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function hostMatchesDenylist(host: string): boolean {
  return SOCIAL_AND_DIRECTORY_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`)
  );
}

/**
 * True when this domain is a plausible organic competitor (another business
 * site), not a social network, UGC platform, or major directory.
 */
export function isTrackableCompetitor(
  domain: string,
  ownDomain?: string | null
): boolean {
  const host = normalizeCompetitorDomain(domain);
  if (!host || !host.includes(".")) return false;
  if (hostMatchesDenylist(host)) return false;

  if (ownDomain) {
    const own = normalizeCompetitorDomain(ownDomain);
    if (own && (host === own || host.endsWith(`.${own}`) || own.endsWith(`.${host}`))) {
      return false;
    }
  }
  return true;
}

/** Filter a discovery result list in place of ad-hoc `.filter` call sites. */
export function filterTrackableCompetitors<T extends { domain: string }>(
  items: T[],
  ownDomain?: string | null
): T[] {
  return items.filter((item) => isTrackableCompetitor(item.domain, ownDomain));
}
