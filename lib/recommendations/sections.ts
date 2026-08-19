// AI Recommendations sections — one inbox, typed tabs, per-tab autopilot.
//
// A recommendation is work the agents proposed. The human either approves,
// declines, or turns Autopilot on for that *section* so matching work ships
// without waiting (e.g. autopilot Google Posts while still reviewing Pages).

import type { Brand } from "../brands";
import type { TaskType } from "../supabase";

export type RecommendationSection =
  | "content"
  | "pages"
  | "meta"
  | "google_posts"
  | "backlinks";

export type RecommendationAutopilot = Partial<Record<RecommendationSection, boolean>>;

export const RECOMMENDATION_SECTIONS: {
  key: RecommendationSection;
  label: string;
  /** Shown under the tab when empty / for the autopilot hint. */
  blurb: string;
  localOnly?: boolean;
}[] = [
  {
    key: "pages",
    label: "Pages",
    blurb: "New service / landing pages waiting to go live.",
  },
  {
    key: "content",
    label: "Content",
    blurb: "Blog posts, rewrites, and FAQ / AI-answer drafts.",
  },
  {
    key: "meta",
    label: "Meta",
    blurb: "Title and meta description rewrites.",
  },
  {
    key: "google_posts",
    label: "Google Posts",
    blurb: "Google Business Profile posts.",
    localOnly: true,
  },
  {
    key: "backlinks",
    label: "Backlinks",
    blurb: "Citation and directory opportunities.",
    localOnly: true,
  },
];

const CONTENT_TASKS = new Set<string>(["improve_content", "new_blog", "geo_answers"]);

/** Which AI Recommendations tab a draft task type belongs to. */
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
    content: !!raw.content,
    pages: !!raw.pages,
    // Preserve legacy auto_publish_meta as the Meta tab default when unset.
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

/** Autopilot for a content draft based on its task_type. */
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
