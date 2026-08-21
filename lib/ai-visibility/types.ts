// AI VISIBILITY — shared types.
//
// One vocabulary for the whole module so the provider adapters, the analyser,
// the store and the report cannot drift apart on what a "check" contains.

/** An assistant we can ask. Free text at the DB layer; this union is what the
 *  application currently understands, same convention as BusinessModel. */
export type AssistantId =
  | "claude"
  | "gemini"
  | "openai"
  | "perplexity"
  /** Google's AI Overview block, read from a SERP via DataForSEO. */
  | "ai_overview";

/** How a real person phrased the question. Drives both prompt generation and
 *  reporting — "we lose on price questions" is a different problem from "we
 *  lose on discovery questions". */
export type PromptIntent =
  | "discovery"
  | "recommendation"
  | "proximity"
  | "comparison"
  | "price"
  | "trust"
  | "problem"
  | "brand"
  | "alternative";

/** A place-and-language the brand is asked about. */
export type Locale = {
  /** Present once persisted; absent for freshly derived locales. */
  id?: string;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  neighborhood: string | null;
  /** The place as it appears inside a prompt, e.g. "Beltline, Calgary". */
  label: string;
  language: string;
  dataforseoLocationCode: number | null;
  source: "parsed" | "explicit";
};

/** One question, fully resolved and ready to send. */
export type VisibilityPrompt = {
  id?: string;
  /** Stable across runs, so one question has a comparable history. */
  promptKey: string;
  intent: PromptIntent;
  templateId: string;
  service: string | null;
  language: string;
  locale: Locale | null;
  text: string;
  weight: number;
};

/** A source an assistant said it used. */
export type AnswerCitation = {
  url: string;
  title: string | null;
  /** Order the assistant listed its sources in, 1-based. */
  position: number;
};

/** What a provider adapter returns. Providers observe; they never interpret. */
export type AssistantAnswer = {
  assistant: AssistantId;
  model: string | null;
  text: string;
  citations: AnswerCitation[];
  latencyMs: number;
  /** Set when the call failed. `text` is then empty and the check is recorded
   *  with the error so a quiet outage is not mistaken for lost visibility. */
  error: string | null;
};

/** A business named in an answer, in the order it was named. */
export type NamedBrand = {
  name: string;
  /** 1-based position in the answer's ordering. */
  rank: number;
  /** True when this is the brand we are measuring. */
  isOwn: boolean;
  /** Set when the name matched a domain we know (own site or tracked competitor). */
  domain: string | null;
};

export type Sentiment = "positive" | "neutral" | "negative";

/** The analyser's verdict on one answer. Pure function of the answer + brand
 *  identity, so it can be re-run over stored answer_text if it improves. */
export type AnswerAnalysis = {
  mentioned: boolean;
  /** 1-based position among the businesses named; null when absent. */
  rank: number | null;
  brandsNamed: NamedBrand[];
  /** Only meaningful when `mentioned`. */
  sentiment: Sentiment | null;
  /** Our share of the businesses named in this answer, 0–100. */
  shareOfVoice: number;
  citations: (AnswerCitation & { domain: string | null; isOwn: boolean })[];
  /** The subset of `citations` that point at the brand's own site — the pages
   *  actually earning the recommendation. */
  ownUrlsCited: string[];
};

/** The identity the analyser matches against. */
export type BrandIdentity = {
  name: string;
  /** Registrable host of the brand's own site, normalised. */
  domain: string | null;
  /** Extra spellings worth matching: legal name, abbreviations, common
   *  misspellings. Supplied by the caller; never guessed here. */
  aliases: string[];
  /** Known competitor domains/names, so a rival is recognised rather than
   *  discovered as an unknown string. */
  competitors: { name: string; domain: string | null }[];
};
