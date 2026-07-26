import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client for server-only use (cron, API routes). Never ship this key to the browser.
// Created lazily so `next build` doesn't need the env vars at build time — they're
// only read when a route actually runs.
let _db: SupabaseClient | null = null;

function getDb(): SupabaseClient {
  if (_db) return _db;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }
  _db = createClient(url, key, { auth: { persistSession: false } });
  return _db;
}

// Proxy so existing `db.from(...)` calls keep working, but the client is only
// built on first use (at request time), never at import/build time.
export const db: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getDb();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

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
