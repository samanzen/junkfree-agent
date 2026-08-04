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
type CallOpts = {
  user: string;
  system?: string;
  search?: boolean;
  maxTokens?: number;
  thinking?: { type: "adaptive" | "disabled" };
};

export async function callClaude({ user, system, search, maxTokens = 2000, thinking }: CallOpts): Promise<string> {
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: user }],
  };
  if (system) body.system = system;
  if (thinking) body.thinking = thinking;
  if (search) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  console.log("[callClaude] provider=anthropic model=" + MODEL);
  console.log("[callClaude] ANTHROPIC_API_KEY present:", !!process.env.ANTHROPIC_API_KEY);
  console.log("[callClaude] request body:", JSON.stringify(body));

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
    console.log("[callClaude] response status:", res.status);
    console.log("[callClaude] response body:", JSON.stringify(data));

    if (!res.ok || data.error) {
      console.log("[callClaude] Anthropic error payload:", JSON.stringify(data?.error) || `Anthropic ${res.status}`);
      throw new Error(data?.error?.message || `Anthropic ${res.status}`);
    }
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
    console.error("[callClaude] caught exception:", e instanceof Error ? e.stack : String(e));
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
