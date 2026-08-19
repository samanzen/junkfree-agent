// AI VISIBILITY — Claude provider.
//
// Reuses lib/anthropic.ts's callClaude with `search: true`, which is what makes
// the answer reflect the live web rather than training data. Citations come back
// through the onCitations hook added for exactly this purpose — before it, every
// source the search tool reported was parsed and discarded.

import { callClaude, type SearchCitation } from "../../anthropic";
import type { AnswerCitation, AssistantAnswer, Locale } from "../types";
import {
  timedAnswer,
  truncateAnswer,
  withAnswerShape,
  type AssistantProvider,
} from "./index";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function toCitations(raw: SearchCitation[]): AnswerCitation[] {
  return raw.map((c, i) => ({ url: c.url, title: c.title, position: i + 1 }));
}

export const claudeProvider: AssistantProvider = {
  id: "claude",
  label: "Claude",
  requires: "ANTHROPIC_API_KEY",
  available: () => !!process.env.ANTHROPIC_API_KEY,

  ask: (promptText: string, _locale: Locale | null): Promise<AssistantAnswer> =>
    timedAnswer("claude", MODEL, async () => {
      let citations: SearchCitation[] = [];
      const text = await callClaude({
        user: withAnswerShape(promptText),
        search: true,
        maxTokens: 1200,
        // The answer is prose, not a reasoning task, and thinking bills against
        // the same budget as the reply — a large thinking spend here would eat
        // the answer we are trying to measure.
        thinking: { type: "disabled" },
        label: "ai-visibility/claude",
        onCitations: (c) => { citations = c; },
      });
      return { text: truncateAnswer(text || ""), citations: toCitations(citations) };
    }),
};
