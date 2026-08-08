// AI logging must never record customer content.
//
// lib/anthropic.ts logged JSON.stringify(body) and JSON.stringify(data) on
// EVERY call. `body` carries brandBlock() — business name, services, service
// area, contact details — plus page content, keyword data and competitor
// intelligence. `data` carries everything the model wrote back. Every tenant's
// business data went into the platform logs, on every call.
//
// These tests capture what is actually written rather than reading the source,
// so a future log line that reintroduces content fails here even if it is
// spelled differently.

import { test, expect, vi, afterEach } from "vitest";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";

/** Distinctive strings standing in for real customer data. */
const SECRETS = {
  business: "ZZBUSINESSNAME-Acme-Roofing-Ltd",
  services: "ZZSERVICES-emergency-roof-repair",
  area: "ZZAREA-Greater-Vancouver",
  phone: "ZZPHONE-604-555-0100",
  competitor: "ZZCOMPETITOR-rivalroofing.example",
  answer: "ZZMODELOUTPUT-the-generated-article-body",
};

const PROMPT = `Business: ${SECRETS.business}
Services: ${SECRETS.services}
Area: ${SECRETS.area}
Phone: ${SECRETS.phone}
Competitors: ${SECRETS.competitor}`;

/** Runs callClaude with logging captured. Returns everything written. */
async function runCapturing(opts: { debug: boolean; fail?: boolean }) {
  vi.resetModules();
  if (opts.debug) process.env.AI_DEBUG_LOGGING = "1";
  else delete process.env.AI_DEBUG_LOGGING;

  const written: string[] = [];
  const sink = (...a: unknown[]) => { written.push(a.map(String).join(" ")); };
  vi.spyOn(console, "log").mockImplementation(sink);
  vi.spyOn(console, "warn").mockImplementation(sink);
  vi.spyOn(console, "error").mockImplementation(sink);

  vi.stubGlobal("fetch", async () =>
    opts.fail
      ? new Response(JSON.stringify({ error: { type: "invalid_request_error", message: `bad field near ${SECRETS.business}` } }), {
          status: 400, headers: { "request-id": "req_test_456" },
        })
      : new Response(
          JSON.stringify({
            content: [{ type: "text", text: SECRETS.answer }],
            stop_reason: "end_turn",
            usage: { input_tokens: 1234, output_tokens: 567, output_tokens_details: { thinking_tokens: 89 } },
          }),
          { status: 200, headers: { "request-id": "req_test_123" } }
        )
  );

  const { callClaude } = await import("../anthropic");
  let threw: Error | null = null;
  let text = "";
  try {
    text = await callClaude({ user: PROMPT, system: "You are a helpful assistant.", label: "acme/stepContent" });
  } catch (e) {
    threw = e as Error;
  }
  return { logs: written.join("\n"), text, threw };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.AI_DEBUG_LOGGING;
});

// ── production: no customer content, ever ──────────────────────────────────
test("production logging records no prompt content", async () => {
  const { logs } = await runCapturing({ debug: false });
  for (const [name, secret] of Object.entries(SECRETS)) {
    expect(logs, `${name} leaked into logs`).not.toContain(secret);
  }
});

test("production logging records no model output", async () => {
  const { logs, text } = await runCapturing({ debug: false });
  expect(text).toBe(SECRETS.answer);           // the caller still gets it
  expect(logs).not.toContain(SECRETS.answer);  // the log does not
});

test("production logging never serializes the request or response body", async () => {
  const { logs } = await runCapturing({ debug: false });
  expect(logs).not.toContain("request body");
  expect(logs).not.toContain("response body");
  expect(logs).not.toContain('"messages"');
  expect(logs).not.toContain('"content"');
});

test("a provider error does not echo the request back into the log", async () => {
  // Anthropic validation errors can quote the offending part of the request —
  // logging the payload would reintroduce exactly what this change removes.
  const { logs, threw } = await runCapturing({ debug: false, fail: true });
  expect(threw).toBeTruthy();
  expect(logs).not.toContain(SECRETS.business);
  expect(logs).toContain("type=invalid_request_error");
  expect(logs).toContain("status=400");
});

// ── operational metadata is retained ───────────────────────────────────────
test("operational fields are still logged", async () => {
  const { logs } = await runCapturing({ debug: false });
  for (const field of [
    "model=",          // which model was billed
    "status=200",      // HTTP outcome
    "request_id=req_test_123", // traceable with the provider
    "in=1234",         // input tokens  — cost
    "out=567",         // output tokens — cost
    "thinking=89",     // thinking tokens, billed against the same budget
    "stop=end_turn",   // truncation detection
    "max_tokens=",     // the budget it ran against
    "ms=",             // latency
    "prompt_chars=",   // size without content
    "label=acme/stepContent", // attribution to a tenant/step
  ]) {
    expect(logs, `${field} missing from production log`).toContain(field);
  }
});

test("prompt size is reported without the prompt", async () => {
  const { logs } = await runCapturing({ debug: false });
  const expected = PROMPT.length + "You are a helpful assistant.".length;
  expect(logs).toContain(`prompt_chars=${expected}`);
});

// ── debug mode ─────────────────────────────────────────────────────────────
test("debug mode is off unless explicitly enabled", async () => {
  const src = (await import("fs")).readFileSync(`${process.cwd()}/lib/anthropic.ts`, "utf8");
  expect(src).toMatch(/process\.env\.AI_DEBUG_LOGGING === "1"/);
  // Not defaulted on, and not enabled by NODE_ENV.
  expect(src).not.toMatch(/AI_DEBUG_LOGGING\s*!==/);
  expect(src).not.toMatch(/NODE_ENV.*!==.*production.*DEBUG/);
});

test("debug mode restores verbose logging when switched on", async () => {
  const { logs } = await runCapturing({ debug: true });
  expect(logs).toContain("DEBUG request body");
  expect(logs).toContain("DEBUG response body");
  expect(logs).toContain(SECRETS.business); // deliberately, in debug only
});

test("every verbose log line is behind the flag", async () => {
  const fs = await import("fs");
  const src = fs.readFileSync(`${process.cwd()}/lib/anthropic.ts`, "utf8");
  // Each JSON.stringify in a log call must be guarded by the debug flag.
  for (const m of src.matchAll(/^.*console\.\w+\([^\n]*JSON\.stringify[^\n]*$/gm)) {
    expect(m[0], `unguarded: ${m[0].trim()}`).toMatch(/DEBUG/);
  }
});

// ── behaviour unchanged ────────────────────────────────────────────────────
test("the API contract is untouched", async () => {
  const { text, threw } = await runCapturing({ debug: false });
  expect(threw).toBeNull();
  expect(text).toBe(SECRETS.answer);
});
