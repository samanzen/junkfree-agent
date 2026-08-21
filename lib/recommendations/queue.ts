export type QueueFilter = "pending" | "approved" | "all";

const PENDING_DRAFT = new Set(["pending_review"]);
const APPROVED_DRAFT = new Set(["approved"]);
const PENDING_CITE = new Set(["suggested", "in_progress", "pending_review"]);
const APPROVED_CITE = new Set(["live"]);

/** Which queue rows belong in Pending / Approved / All. */
export function matchesQueueFilter(
  status: string,
  filter: QueueFilter,
  kind: "draft" | "post" | "citation" = "draft"
): boolean {
  const pending = kind === "citation" ? PENDING_CITE : PENDING_DRAFT;
  const approved = kind === "citation" ? APPROVED_CITE : APPROVED_DRAFT;
  if (filter === "pending") return pending.has(status);
  if (filter === "approved") return approved.has(status);
  return pending.has(status) || approved.has(status);
}

export const QUEUE_FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "pending", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "all", label: "All" },
];
