// AI VISIBILITY — answer analysis.
//
// Takes what an assistant actually said and extracts the facts a report needs:
// were we named, where in the list, who else was named, how were we described,
// and which URLs did the assistant lean on (flagging ours).
//
// Two hard rules:
//
//  1. PURE. No network, no model, no clock. The input is an answer plus the
//     brand's identity; the output is a verdict. That is what lets the same
//     function be re-run over stored `answer_text` when the extraction
//     improves — history is re-derivable rather than frozen at write time.
//
//  2. DETERMINISTIC FIRST. Named entities are found by structure (numbered and
//     bulleted lists, bold-led names) and by matching identities we already
//     hold (our own name/aliases/domain, tracked competitors). Free-prose name
//     discovery is intentionally conservative: a missed competitor is a gap in
//     a nice-to-have column, whereas a hallucinated one would corrupt share of
//     voice, which is a headline number.

import { normalizeCompetitorDomain } from "../competitors/filter";
import type {
  AnswerAnalysis,
  AnswerCitation,
  BrandIdentity,
  NamedBrand,
  Sentiment,
} from "./types";

/** Lowercase, accent-free, punctuation-as-space. Used only for matching. */
export function normalizeForMatch(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether `needle` appears in `haystack` on word boundaries.
 *
 * Both sides are normalised so punctuation cannot hide a match, and both are
 * space-padded so "Free" cannot match inside "Junk Free" — a substring test on
 * raw text would report a mention for any brand whose name is a common word.
 */
export function mentionsPhrase(haystack: string, needle: string): boolean {
  const n = normalizeForMatch(needle);
  if (!n) return false;
  return ` ${normalizeForMatch(haystack)} `.includes(` ${n} `);
}

/**
 * Every spelling worth matching for one identity.
 *
 * The bare domain label ("junkfree" from junkfree.ca) is included only when
 * it is at least five characters. Below that the false-positive risk in prose
 * outweighs the recall — "ace" from ace.com would match "ace" in any sentence.
 */
export function identityPhrases(name: string, domain: string | null, aliases: string[] = []): string[] {
  const phrases = new Set<string>();
  const add = (v: string | null | undefined) => {
    const t = (v || "").trim();
    if (t) phrases.add(t);
  };

  add(name);
  for (const a of aliases) add(a);

  if (domain) {
    const host = normalizeCompetitorDomain(domain);
    add(host);
    const label = host.split(".")[0];
    if (label && label.length >= 5) add(label);
  }

  return [...phrases];
}

/** True when `host` is the domain itself or a subdomain of it. */
export function isSameDomain(host: string | null, own: string | null): boolean {
  if (!host || !own) return false;
  const a = normalizeCompetitorDomain(host);
  const b = normalizeCompetitorDomain(own);
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

/** Trailing punctuation and list scaffolding a captured name picks up. */
function cleanCandidateName(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/^[\s*\-–—•·]+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/[\s:;,.\-–—]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Words that begin a line which is prose, not a business name. Assistants
 * routinely bullet advice ("Check reviews before hiring"), and those lines must
 * not be counted as competitors.
 */
const PROSE_LEADERS = new Set([
  "check", "make", "ask", "consider", "look", "compare", "read", "verify",
  "ensure", "confirm", "get", "always", "avoid", "note", "keep", "remember",
  "if", "when", "before", "after", "however", "overall", "in", "for", "to",
  "you", "they", "it", "this", "that", "these", "those", "here", "there",
  "some", "many", "most", "based", "according", "please", "disclaimer",
  "i", "we", "my", "your", "their", "recommendation", "recommendations",
  "tip", "tips", "summary", "conclusion", "important", "caveat",
]);

/** Upper bound on a captured business name, in words. Longer is a sentence. */
const MAX_NAME_WORDS = 7;

/**
 * Whether a captured string plausibly names a business.
 *
 * Deliberately strict. The cost of accepting prose is a fabricated competitor
 * in share of voice; the cost of rejecting a real name is that it still gets
 * picked up by identity matching if we already track it.
 */
export function looksLikeBusinessName(candidate: string): boolean {
  const name = candidate.trim();
  if (name.length < 2 || name.length > 80) return false;

  const words = name.split(/\s+/);
  if (words.length > MAX_NAME_WORDS) return false;

  const first = normalizeForMatch(words[0]);
  if (!first || PROSE_LEADERS.has(first)) return false;

  // Sentence punctuation inside the candidate means we captured prose.
  if (/[.!?]\s/.test(name)) return false;

  // At least one token that starts with a capital or a digit — business names
  // are proper nouns ("1-800-GOT-JUNK", "Acme Plumbing").
  return words.some((w) => /^[A-Z0-9]/.test(w));
}

/**
 * Names pulled out of the answer's own structure, in the order they appear.
 *
 * Three shapes cover essentially everything assistants produce:
 *   "1. Acme Plumbing — fast and affordable"
 *   "- Acme Plumbing: good reviews"
 *   "**Acme Plumbing** is a solid choice"
 */
export function extractStructuredNames(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const name = cleanCandidateName(raw);
    if (!looksLikeBusinessName(name)) return;
    const key = normalizeForMatch(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Numbered or bulleted item: take the segment before the first separator.
    const listed = trimmed.match(/^(?:\d+[.)]|[-–—*•·])\s+(.{2,120})$/);
    if (listed) {
      const head = listed[1].split(/\s+[–—]\s+|\s+-\s+|:\s+|\s+\(|\s*\|\s*|,\s/)[0];
      push(head);
      continue;
    }

    // A line that opens with a bolded name.
    const bolded = trimmed.match(/^\*\*(.{2,80}?)\*\*/);
    if (bolded) push(bolded[1]);
  }

  return out;
}

const POSITIVE_CUES = [
  "best", "top", "excellent", "outstanding", "highly rated", "highly recommended",
  "recommended", "reliable", "trusted", "trustworthy", "great", "strong",
  "leading", "well reviewed", "well regarded", "reputable", "professional",
  "responsive", "affordable", "good value", "solid choice", "popular choice",
];

const NEGATIVE_CUES = [
  "avoid", "worst", "poor", "complaints", "not recommended", "unreliable",
  "mixed reviews", "negative reviews", "caution", "be careful", "expensive",
  "overpriced", "slow to respond", "unresponsive", "disappointing", "scam",
];

/**
 * How the brand was characterised, from the sentences that name it.
 *
 * A cue-word heuristic, and labelled as one: it reads only the sentences the
 * brand appears in, so praise of a competitor elsewhere in the answer cannot
 * be attributed to us. Ambiguous or cue-free text is `neutral` rather than
 * being forced into a polarity.
 */
export function sentimentForBrand(text: string, phrases: string[]): Sentiment | null {
  const sentences = text
    .split(/(?<=[.!?])\s+|\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const relevant = sentences.filter((s) => phrases.some((p) => mentionsPhrase(s, p)));
  if (!relevant.length) return null;

  const blob = normalizeForMatch(relevant.join(" "));
  let score = 0;
  for (const cue of POSITIVE_CUES) if (blob.includes(normalizeForMatch(cue))) score += 1;
  for (const cue of NEGATIVE_CUES) if (blob.includes(normalizeForMatch(cue))) score -= 1;

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

/**
 * Analyse one assistant answer.
 *
 * `mentioned` is true when the brand appears in the answer AT ALL — named in
 * the prose or cited as a source. Being cited without being named is still
 * visibility, and it is the case that most often goes unnoticed. `rank` stays
 * null in that situation, because there is no position in a list we were not
 * listed in.
 */
export function analyzeAnswer(
  text: string,
  citations: AnswerCitation[],
  brand: BrandIdentity
): AnswerAnalysis {
  const answer = text || "";
  const ownPhrases = identityPhrases(brand.name, brand.domain, brand.aliases);

  // ── Citations ─────────────────────────────────────────────────────────────
  const analysedCitations = citations.map((c) => {
    const domain = c.url ? normalizeCompetitorDomain(c.url) || null : null;
    return { ...c, domain, isOwn: isSameDomain(domain, brand.domain) };
  });
  const ownUrlsCited = [...new Set(analysedCitations.filter((c) => c.isOwn).map((c) => c.url))];

  // ── Named businesses, in the order the answer named them ──────────────────
  const structured = extractStructuredNames(answer);

  const named: NamedBrand[] = [];
  const claimed = new Set<string>();

  const claim = (name: string, isOwn: boolean, domain: string | null) => {
    const key = normalizeForMatch(name);
    if (!key || claimed.has(key)) return;
    claimed.add(key);
    named.push({ name, rank: named.length + 1, isOwn, domain });
  };

  // Structural order wins, and each structural name is checked against the
  // identities we hold so "Junk Free Calgary" in a list is recognised as us
  // rather than logged as an unknown third party.
  for (const candidate of structured) {
    const isOwn = ownPhrases.some((p) => mentionsPhrase(candidate, p));
    const competitor = brand.competitors.find(
      (c) => mentionsPhrase(candidate, c.name) || (c.domain ? mentionsPhrase(candidate, c.domain) : false)
    );
    claim(candidate, isOwn, isOwn ? brand.domain : competitor?.domain ?? null);
  }

  // Identities present in the prose but outside any list structure. Appended in
  // order of first appearance so ordering stays meaningful.
  type Pending = { name: string; isOwn: boolean; domain: string | null; at: number };
  const pending: Pending[] = [];
  const normalisedAnswer = ` ${normalizeForMatch(answer)} `;

  const firstIndexOf = (phrase: string): number => {
    const n = normalizeForMatch(phrase);
    if (!n) return -1;
    return normalisedAnswer.indexOf(` ${n} `);
  };

  if (!named.some((n) => n.isOwn)) {
    let earliest = -1;
    for (const p of ownPhrases) {
      const at = firstIndexOf(p);
      if (at >= 0 && (earliest < 0 || at < earliest)) earliest = at;
    }
    if (earliest >= 0) pending.push({ name: brand.name, isOwn: true, domain: brand.domain, at: earliest });
  }

  for (const competitor of brand.competitors) {
    const already = named.some(
      (n) => mentionsPhrase(n.name, competitor.name) || (competitor.domain ? isSameDomain(n.domain, competitor.domain) : false)
    );
    if (already) continue;

    let earliest = -1;
    for (const p of identityPhrases(competitor.name, competitor.domain)) {
      const at = firstIndexOf(p);
      if (at >= 0 && (earliest < 0 || at < earliest)) earliest = at;
    }
    if (earliest >= 0) {
      pending.push({ name: competitor.name, isOwn: false, domain: competitor.domain, at: earliest });
    }
  }

  pending.sort((a, b) => a.at - b.at);
  for (const p of pending) claim(p.name, p.isOwn, p.domain);

  // ── Verdict ───────────────────────────────────────────────────────────────
  const ownEntry = named.find((n) => n.isOwn) || null;
  const namedInText = !!ownEntry;
  const mentioned = namedInText || ownUrlsCited.length > 0;

  const shareOfVoice = named.length
    ? Math.round((named.filter((n) => n.isOwn).length / named.length) * 10000) / 100
    : 0;

  return {
    mentioned,
    rank: ownEntry ? ownEntry.rank : null,
    brandsNamed: named,
    sentiment: namedInText ? sentimentForBrand(answer, ownPhrases) : null,
    shareOfVoice,
    citations: analysedCitations,
    ownUrlsCited,
  };
}

/** The identity to analyse against, assembled from a brand row. */
export function identityOf(
  brand: { name: string; site_url?: string | null; competitors?: string | null },
  extra: { aliases?: string[]; competitors?: { name: string; domain: string | null }[] } = {}
): BrandIdentity {
  const domain = brand.site_url ? normalizeCompetitorDomain(brand.site_url) || null : null;

  // brands.competitors is free text ("1-800-GOT-JUNK, binthere.ca"). An entry
  // containing a dot is treated as a domain as well as a name, which is how a
  // citation to that host gets attributed to the right rival.
  const fromBrandField = (brand.competitors || "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => ({
      name: entry,
      domain: entry.includes(".") ? normalizeCompetitorDomain(entry) || null : null,
    }));

  const merged = [...fromBrandField, ...(extra.competitors || [])];
  const deduped: { name: string; domain: string | null }[] = [];
  const seen = new Set<string>();
  for (const c of merged) {
    const key = normalizeForMatch(c.name) || c.domain || "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }

  return { name: brand.name, domain, aliases: extra.aliases || [], competitors: deduped };
}
