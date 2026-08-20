// APPROVE → LIVE PUBLISH.
//
// Human Approve used to stop at the `content` table. That is still the
// in-platform store, but a connected last-mile adapter must also receive the
// change — otherwise publish_executions / publish_checks stay empty forever.
//
// Never throws: Approve has already saved the draft. A live-queue failure
// must not roll that back. improve_content is refused by toSiteChange.

import { enqueue } from "../queue";
import { toSiteChange, type DraftLike } from "./changes";
import { resolvePublishTarget } from "./engine";
import { supports } from "./types";

export type ApprovedDraft = DraftLike & { id: string };

/**
 * Human Approve of fix_meta never shows a picker today, so option 0 matches
 * what Autopilot already sends. toSiteChange will not pick for us.
 */
export function metaChoiceForHumanApprove(taskType: string): number | undefined {
  return taskType === "fix_meta" ? 0 : undefined;
}

export async function queueLivePublishIfConnected(
  brand: { id: string; name: string },
  draft: ApprovedDraft
): Promise<{ queued: boolean }> {
  try {
    const metaChoice = metaChoiceForHumanApprove(draft.task_type);
    const translation = toSiteChange(draft, brand.name, metaChoice);
    if (!translation.publishable) return { queued: false };

    const target = await resolvePublishTarget(brand.id);
    if (!target.ok) return { queued: false };
    if (!supports(target.adapter, translation.change)) return { queued: false };

    await enqueue(brand.id, "publish", {
      draftId: draft.id,
      ...(typeof metaChoice === "number" ? { metaChoice } : {}),
    });
    return { queued: true };
  } catch (e) {
    console.warn(
      `[approve] live publish not queued for draft ${draft.id}: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    return { queued: false };
  }
}
