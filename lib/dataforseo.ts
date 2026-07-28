// DataForSEO client — the "eyes" of the platform. Real Google data: search
// volume, keyword difficulty, competitor rankings, SERP results. Auth is HTTP
// Basic with DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD. All calls degrade
// gracefully (return [] if unconfigured or on error) so the agent never breaks.

const BASE = "https://api.dataforseo.com/v3";

function authHeader(): string | null {
  const login = process.env.DATAFORSEO_LOGIN;
  const pass = process.env.DATAFORSEO_PASSWORD;
  if (!login || !pass) return null;
  return "Basic " + Buffer.from(`${login}:${pass}`).toString("base64");
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  const auth = authHeader();
  if (!auth) return null;
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify([body]), // DataForSEO expects an array of tasks
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const LOCATION_CANADA = 2124; // DataForSEO location code for Canada
const LANG = "en";

type Task<R> = { tasks?: { result?: R[] }[] };

// Real search volume + competition for a set of seed keywords.
export type KeywordData = {
  keyword: string;
  volume: number | null;
  competition: number | null;
  cpc: number | null;
};
export async function keywordVolumes(keywords: string[]): Promise<KeywordData[]> {
  const data = await post<Task<{ keyword: string; search_volume: number; competition: number; cpc: number }>>(
    "/keywords_data/google_ads/search_volume/live",
    { keywords: keywords.slice(0, 100), location_code: LOCATION_CANADA, language_code: LANG }
  );
  const rows = data?.tasks?.[0]?.result || [];
  return rows.map((r) => ({
    keyword: r.keyword,
    volume: r.search_volume ?? null,
    competition: r.competition ?? null,
    cpc: r.cpc ?? null,
  }));
}

// Keyword ideas/expansions for a seed term (long-tail discovery).
export async function keywordIdeas(seed: string): Promise<KeywordData[]> {
  const data = await post<Task<{ keyword: string; keyword_info?: { search_volume: number; competition: number; cpc: number } }>>(
    "/dataforseo_labs/google/keyword_ideas/live",
    { keywords: [seed], location_code: LOCATION_CANADA, language_code: LANG, limit: 50 }
  );
  const rows = data?.tasks?.[0]?.result?.[0] ? (data.tasks[0].result as unknown as { items?: { keyword: string; keyword_info?: { search_volume: number; competition: number; cpc: number } }[] }[])[0]?.items || [] : [];
  return rows.map((r) => ({
    keyword: r.keyword,
    volume: r.keyword_info?.search_volume ?? null,
    competition: r.keyword_info?.competition ?? null,
    cpc: r.keyword_info?.cpc ?? null,
  }));
}

// Keywords a competitor domain ranks for that you may not — gap analysis.
export async function rankedKeywords(domain: string): Promise<{ keyword: string; position: number; volume: number | null }[]> {
  const data = await post<Task<unknown>>(
    "/dataforseo_labs/google/ranked_keywords/live",
    { target: domain, location_code: LOCATION_CANADA, language_code: LANG, limit: 100 }
  );
  const items = (data?.tasks?.[0]?.result?.[0] as { items?: { keyword_data?: { keyword: string; keyword_info?: { search_volume: number } }; ranked_serp_element?: { serp_item?: { rank_absolute: number } } }[] })?.items || [];
  return items.map((it) => ({
    keyword: it.keyword_data?.keyword || "",
    position: it.ranked_serp_element?.serp_item?.rank_absolute ?? 0,
    volume: it.keyword_data?.keyword_info?.search_volume ?? null,
  })).filter((x) => x.keyword);
}

// The live top-10 organic results for a keyword — input to the SERP Analyst.
export async function serpTop(keyword: string): Promise<{ position: number; title: string; url: string; description: string }[]> {
  const data = await post<Task<unknown>>(
    "/serp/google/organic/live/advanced",
    { keyword, location_code: LOCATION_CANADA, language_code: LANG, depth: 10 }
  );
  const items = (data?.tasks?.[0]?.result?.[0] as { items?: { type: string; rank_absolute: number; title: string; url: string; description: string }[] })?.items || [];
  return items
    .filter((i) => i.type === "organic")
    .slice(0, 10)
    .map((i) => ({ position: i.rank_absolute, title: i.title, url: i.url, description: i.description }));
}

export function isConfigured() {
  return !!authHeader();
}

// Domain overview: organic traffic estimate, organic keyword count, rank.
export async function domainOverview(domain: string): Promise<{ organic_traffic: number | null; organic_keywords: number | null } | null> {
  const data = await post<Task<unknown>>(
    "/dataforseo_labs/google/domain_rank_overview/live",
    { target: domain, location_code: LOCATION_CANADA, language_code: LANG }
  );
  const item = (data?.tasks?.[0]?.result?.[0] as { items?: { metrics?: { organic?: { etv?: number; count?: number } } }[] })?.items?.[0];
  const organic = item?.metrics?.organic;
  if (!organic) return null;
  return { organic_traffic: Math.round(organic.etv || 0), organic_keywords: organic.count ?? null };
}

// Backlinks summary: total backlinks + referring domains.
export async function backlinksSummary(domain: string): Promise<{ backlinks: number | null; referring_domains: number | null } | null> {
  const data = await post<Task<unknown>>(
    "/backlinks/summary/live",
    { target: domain, internal_list_limit: 1, backlinks_status_type: "live" }
  );
  const r = data?.tasks?.[0]?.result?.[0] as { backlinks?: number; referring_domains?: number } | undefined;
  if (!r) return null;
  return { backlinks: r.backlinks ?? null, referring_domains: r.referring_domains ?? null };
}
