/**
 * GitHub App website connection — plan (implementation notes)
 *
 * Replaces customer PAT form with GitHub App install → repo select → analyze → confirm.
 *
 * Reuse:
 * - Google OAuth state HMAC pattern (lib/google/oauth.ts)
 * - brand_integrations via upsertIntegrationCredentials (metadata holds install/repo IDs)
 * - githubAdapter PR publishing spine (token resolved from App installation)
 * - requireAuth + requireBrandAccess
 *
 * Permissions (documented):
 * - Metadata: Read — list installation/repos
 * - Contents: Read/Write — analyze + commit on PR branches
 * - Pull requests: Read/Write — open/track PRs (existing publishing policy)
 *
 * Secrets (env, never browser):
 * - GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_SLUG
 * - GITHUB_APP_WEBHOOK_SECRET
 * - State HMAC uses INTEGRATION_ENCRYPTION_KEY (or GITHUB_APP_STATE_SECRET)
 *
 * PAT: only if GITHUB_ALLOW_PAT_FALLBACK=1 (admin migration); hidden from customer UI.
 */

export const GITHUB_APP_PERMISSIONS = {
  metadata: "read",
  contents: "read_write",
  pull_requests: "read_write",
} as const;
