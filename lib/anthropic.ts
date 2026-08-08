// Thin server-side wrapper over the Anthropic Messages API.
// Uses ANTHROPIC_API_KEY from the environment — never exposed to the browser.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API = "https://api.anthropic.com/v1/messages";

// `thinking` is optional and defaults to undefined, which preserves the exact
// behaviour every existing caller already had. Pass { type: "disabled" } when a
// call must spend its whole max_tokens budget on the visible answer -- on
// current models thinking is ON by default and is billed against the SAME
// max_tokens as the response text, so a large reasoning task under a small
// budget can consume the entire allowance and return no text at all.
/** Response metadata a caller needs to tell a complete answer from a cut-off one. */
export type CallMeta = {
  stop_reason: string | null;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
};

type CallOpts = {
  user: string;
  system?: string;
  search?: boolean;
  maxTokens?: number;
  thinking?: { type: "adaptive" | "disabled" };
  /**
   * Receives the response metadata. `stop_reason === "max_tokens"` means the
   * answer was cut off mid-generation -- callers that parse structured output
   * must treat that as a failure rather than trusting a partial result.
   * Optional, so existing callers are unaffected.
   */
  onMeta?: (meta: CallMeta) => void;
  /**
   * Non-sensitive tag for the log line — a brand slug and/or the step making
   * the call, e.g. "acme-roofing/stepContent". Optional, so no existing caller
   * changes; supplying it is what lets an operator attribute cost and latency
   * to a tenant without any prompt content being recorded.
   *
   * Must never carry customer content. It is written to logs verbatim.
   */
  label?: string;
};

/**
 * Verbose prompt/response logging. OFF unless explicitly switched on.
 *
 * The default MUST stay off: `body` carries brandBlock() — the customer's
 * business name, services, service area and contact details — plus page
 * content, keyword data and competitor intelligence, and `data` carries
 * everything the model wrote back. Serialising either put every tenant's
 * business data into the platform logs on every call, which is a data-
 * processing liability as much as a cost.
 *
 * Opt in per environment with AI_DEBUG_LOGGING=1. Never set it in production.
 */
const DEBUG_AI_LOGGING = process.env.AI_DEBUG_LOGGING === "1";

export async function callClaude({ user, system, search, maxTokens = 2000, thinking, onMeta, label }: CallOpts): Promise<string> {
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: user }],
  };
  if (system) body.system = system;
  if (thinking) body.thinking = thinking;
  if (search) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  // Sizes, not contents: enough to spot a runaway prompt without recording it.
  const promptChars = user.length + (system?.length ?? 0);
  const tag = label ? ` label=${label}` : "";
  const startedAt = Date.now();
  // Set once the provider failure has already been logged with its type and
  // status. The Error thrown from that branch carries Anthropic's own message,
  // which CAN quote the offending part of the request — so the catch block
  // must not print it a second time. Messages from genuine exceptions
  // (network, JSON parse) are safe and still logged.
  let providerErrorReported = false;

  if (DEBUG_AI_LOGGING) {
    console.warn("[callClaude] DEBUG request body:", JSON.stringify(body));
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const ms = Date.now() - startedAt;
    // Anthropic returns this on every response; it is what support needs to
    // trace a single call, and it identifies nothing about the customer.
    const requestId = res.headers.get("request-id") ?? "-";

    if (DEBUG_AI_LOGGING) {
      console.warn("[callClaude] DEBUG response body:", JSON.stringify(data));
    }

    if (!res.ok || data.error) {
      // The error TYPE and status, not the payload: provider validation errors
      // can quote the offending part of the request back at you, which would
      // reintroduce exactly what this change removes.
      console.error(
        `[callClaude] FAILED${tag} model=${MODEL} status=${res.status} ` +
        `type=${data?.error?.type ?? "unknown"} request_id=${requestId} ` +
        `prompt_chars=${promptChars} max_tokens=${maxTokens} ms=${ms}`
      );
      providerErrorReported = true;
      throw new Error(data?.error?.message || `Anthropic ${res.status}`);
    }

    console.log(
      `[callClaude] ok${tag} model=${MODEL} status=${res.status} request_id=${requestId} ` +
      `in=${data.usage?.input_tokens ?? 0} out=${data.usage?.output_tokens ?? 0} ` +
      `thinking=${data.usage?.output_tokens_details?.thinking_tokens ?? 0} ` +
      `stop=${data.stop_reason ?? "-"} prompt_chars=${promptChars} max_tokens=${maxTokens} ms=${ms}`
    );
    onMeta?.({
      stop_reason: data.stop_reason ?? null,
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
      thinking_tokens: data.usage?.output_tokens_details?.thinking_tokens ?? 0,
    });

    const text = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();

    // A 200 response with no text block is the failure mode that used to be
    // invisible: the model spent the whole max_tokens budget on thinking and
    // never emitted an answer. Callers only saw "" and could not tell that
    // apart from a genuinely empty reply, so log the diagnosis here once.
    if (!text) {
      const blocks = (data.content || []).map((b: { type: string }) => b.type).join(",") || "none";
      console.warn(
        `[callClaude] EMPTY TEXT — stop_reason=${data.stop_reason} blocks=[${blocks}] ` +
        `output_tokens=${data.usage?.output_tokens} thinking_tokens=${data.usage?.output_tokens_details?.thinking_tokens ?? 0} ` +
        `max_tokens=${maxTokens}. If thinking consumed the budget, raise maxTokens or pass thinking:{type:"disabled"}.`
      );
    }

    return text;
  } catch (e) {
    // Name and message only. The stack is a code path, not customer data, but
    // it is noisy in production and adds nothing the message doesn't — it is
    // available under the debug flag when actually diagnosing something.
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(
      `[callClaude] EXCEPTION${tag} model=${MODEL} name=${err.name} ` +
      `ms=${Date.now() - startedAt} ` +
      // See providerErrorReported: the provider's own message can echo request
      // content, and that failure has already been logged with its type.
      (providerErrorReported ? "message=(provider error, reported above)" : `message=${err.message}`)
    );
    if (DEBUG_AI_LOGGING) console.error("[callClaude] DEBUG stack:", err.stack);
    throw e;
  }
}

// Pull the first JSON object/array out of a model response.
export function extractJSON<T = unknown>(text: string): T | null {
  if (!text) return null;
  const t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const starts = [t.indexOf("{"), t.indexOf("[")].filter((n) => n >= 0);
  if (!starts.length) return null;
  const s = Math.min(...starts);
  const e = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (e < 0) return null;
  try {
    return JSON.parse(t.slice(s, e + 1)) as T;
  } catch {
    return null;
  }
}
