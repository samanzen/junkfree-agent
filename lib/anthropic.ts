// Thin server-side wrapper over the Anthropic Messages API.
// Uses ANTHROPIC_API_KEY from the environment — never exposed to the browser.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API = "https://api.anthropic.com/v1/messages";

type CallOpts = { user: string; system?: string; search?: boolean; maxTokens?: number };

export async function callClaude({ user, system, search, maxTokens = 2000 }: CallOpts): Promise<string> {
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: user }],
  };
  if (system) body.system = system;
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
    return (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
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
