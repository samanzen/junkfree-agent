// AI Recommendations sections — one inbox, typed tabs, per-tab mode.
//
// Mode is either:
//   • I'll choose  — human reviews / clicks each item
//   • Do automatically — matching work ships or is queued without waiting
//
// "Autopilot" in the data model is the boolean for "Do automatically".

import type { TaskType } from "../supabase";

export type RecommendationSection =
  | "issues"
  | "opportunities"
  | "content"
  | "pages"
  | "meta"
  | "google_posts"
  | "backlinks";

export type RecommendationAutopilot = Partial<Record<RecommendationSection, boolean>>;

export type SectionKind = "action" | "draft" | "local";

export const RECOMMENDATION_SECTIONS: {
  key: RecommendationSection;
  label: string;
  blurb: string;
  kind: SectionKind;
  /** Short plain-English for the mode control. */
  autoLabel: string;
  manualLabel: string;
  autoHint: string;
  manualHint: string;
  localOnly?: boolean;
  tone?: "issue" | "opp";
}[] = [
  {
    key: "issues",
    label: "Issues",
    blurb: "Searches that slipped in Google.",
    kind: "action",
    tone: "issue",
    manualLabel: "I'll choose",
    autoLabel: "Do automatically",
    manualHint: "You pick which slips to send to the AI.",
    autoHint: "New slips are sent to the AI to fix — no clicking each one.",
  },
  {
    key: "opportunities",
    label: "Almost page 1",
    blurb: "Searches sitting just off Google’s first page.",
    kind: "action",
    tone: "opp",
    manualLabel: "I'll choose",
    autoLabel: "Do automatically",
    manualHint: "You pick which terms to push.",
    autoHint: "Close-to-page-1 terms are pushed by the AI automatically.",
  },
  {
    key: "pages",
    label: "Pages",
    blurb: "New service / landing pages waiting to go live.",
    kind: "draft",
    manualLabel: "I'll choose",
    autoLabel: "Do automatically",
    manualHint: "You approve each new page before it goes live.",
    autoHint: "New pages go live without waiting for your click.",
  },
  {
    key: "content",
    label: "Content",
    blurb: "Blog posts, rewrites, and FAQ / AI-answer drafts.",
    kind: "draft",
    manualLabel: "I'll choose",
    autoLabel: "Do automatically",
    manualHint: "You review each draft before publish.",
    autoHint: "Content drafts publish without waiting for your click.",
  },
  {
    key: "meta",
    label: "Meta",
    blurb: "Title and meta description rewrites.",
    kind: "draft",
    manualLabel: "I'll choose",
    autoLabel: "Do automatically",
    manualHint: "You approve each title/meta change.",
    autoHint: "Title and meta updates apply automatically.",
  },
  {
    key: "google_posts",
    label: "Google Posts",
    blurb: "Google Business Profile posts.",
    kind: "local",
    localOnly: true,
    manualLabel: "I'll choose",
    autoLabel: "Do automatically",
    manualHint: "You approve each Google post.",
    autoHint: "Google posts are accepted automatically.",
  },
  {
    key: "backlinks",
    label: "Backlinks",
    blurb: "Citation and directory opportunities.",
    kind: "local",
    localOnly: true,
    manualLabel: "I'll choose",
    autoLabel: "Do automatically",
    manualHint: "You approve each citation opportunity.",
    autoHint: "Citation opportunities are accepted automatically.",
  },
];

const CONTENT_TASKS = new Set<string>(["improve_content", "new_blog", "geo_answers"]);

/** Which draft tab a draft task type belongs to. */
export function sectionForTaskType(taskType: string): RecommendationSection {
  if (taskType === "new_page") return "pages";
  if (taskType === "fix_meta") return "meta";
  if (CONTENT_TASKS.has(taskType)) return "content";
  return "content";
}

export function readAutopilotMap(brand: {
  recommendation_autopilot?: RecommendationAutopilot | null;
  auto_publish_meta?: boolean | null;
}): RecommendationAutopilot {
  const raw = brand.recommendation_autopilot || {};
  return {
    issues: !!raw.issues,
    opportunities: !!raw.opportunities,
    content: !!raw.content,
    pages: !!raw.pages,
    meta: raw.meta != null ? !!raw.meta : !!brand.auto_publish_meta,
    google_posts: !!raw.google_posts,
    backlinks: !!raw.backlinks,
  };
}

export function isSectionAutopilot(
  brand: {
    recommendation_autopilot?: RecommendationAutopilot | null;
    auto_publish_meta?: boolean | null;
  },
  section: RecommendationSection
): boolean {
  return !!readAutopilotMap(brand)[section];
}

export function isDraftAutopilot(
  brand: {
    recommendation_autopilot?: RecommendationAutopilot | null;
    auto_publish_meta?: boolean | null;
  },
  taskType: TaskType | string
): boolean {
  return isSectionAutopilot(brand, sectionForTaskType(taskType));
}

export function mergeAutopilotUpdate(
  current: RecommendationAutopilot,
  section: RecommendationSection,
  enabled: boolean
): RecommendationAutopilot {
  return { ...current, [section]: enabled };
}

export function sectionMeta(key: RecommendationSection) {
  return RECOMMENDATION_SECTIONS.find((s) => s.key === key)!;
}
