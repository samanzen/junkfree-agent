import { createClient } from "@supabase/supabase-js";

// Service-role client for server-only use (cron, API routes). Never ship this key to the browser.
export const db = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export type TaskType =
  | "fix_meta"
  | "improve_content"
  | "new_page"
  | "new_blog"
  | "technical_fix";

export type Draft = {
  id: string;
  run_id: string;
  task_type: TaskType;
  target_url: string | null;
  target_keyword: string | null;
  title: string;
  body: string; // markdown or JSON payload depending on task_type
  rationale: string;
  status: "pending_review" | "approved" | "published" | "dismissed";
  created_at: string;
};
