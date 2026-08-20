import { slugify } from "../utils";

export type TopicInput = {
  id?: string;
  taskType?: string | null;
  task_type?: string | null;
  keyword?: string | null;
  target_keyword?: string | null;
  title?: string | null;
  url?: string | null;
  target_url?: string | null;
  body?: string | null;
  status?: string | null;
};

export function normalizeTopic(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(blog|page|new blog|new page|intent fix|meta rewrite|audit \+ rewrite|ai-answer):\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function lastPathSegment(url: string): string {
  try {
    const path = (url.startsWith("http") ? new URL(url).pathname : url).replace(/\/+$/, "");
    return path.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}

/** Stable slug for the topic, ignoring host names so a keyword and its planned URL match. */
export function topicSlug(input: TopicInput): string {
  const keyword = input.keyword || input.target_keyword || "";
  const fromKw = keyword ? slugify(normalizeTopic(keyword)) : "";
  if (fromKw) return fromKw;
  const url = input.url || input.target_url || "";
  const fromUrl = url ? slugify(normalizeTopic(lastPathSegment(url) || url)) : "";
  if (fromUrl) return fromUrl;
  const title = input.title || "";
  return title ? slugify(normalizeTopic(title)) : "";
}

export function topicKey(input: TopicInput): string {
  const task = (input.taskType || input.task_type || "").toLowerCase().trim();
  return `${task}:${topicSlug(input)}`;
}

export function overlapsTopic(candidate: string | null | undefined, existing: TopicInput): boolean {
  const a = candidate ? topicSlug({ keyword: candidate }) : "";
  const b = topicSlug(existing);
  return Boolean(a && b && a === b);
}

/** Keep one open draft per topic. Prefer pending review, then the longer body. */
export function uniqueByTopic<T extends TopicInput>(drafts: T[]): T[] {
  const chosen = new Map<string, T>();
  const order: string[] = [];
  drafts.forEach((d, i) => {
    const slug = topicSlug(d);
    const key = slug ? topicKey(d) : `row:${d.id || i}`;
    const prev = chosen.get(key);
    if (!prev) {
      chosen.set(key, d);
      order.push(key);
      return;
    }
    const prevPending = (prev.status || "") === "pending_review";
    const nextPending = (d.status || "") === "pending_review";
    if (nextPending && !prevPending) {
      chosen.set(key, d);
      return;
    }
    if (prevPending && !nextPending) return;
    if ((d.body || "").length > (prev.body || "").length) chosen.set(key, d);
  });
  return order.map((k) => chosen.get(k)!);
}

export function siblingDrafts<T extends TopicInput>(draft: T, all: T[]): T[] {
  const key = topicKey(draft);
  if (!topicSlug(draft)) return [];
  return all.filter((other) => other.id !== draft.id && topicKey(other) === key);
}

export function factsKey(brandId: string, keyword: string): string {
  return `${brandId}::${keyword.trim().toLowerCase()}`;
}
