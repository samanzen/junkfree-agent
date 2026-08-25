/**
 * GitHub App — website connection setup
 *
 * Customer flow uses the Volo GitHub App (not OAuth App, not customer PATs).
 *
 * ## GitHub App settings (github.com → Settings → Developer settings → GitHub Apps)
 *
 * Permissions (minimum):
 * - Repository → Metadata: Read-only
 * - Repository → Contents: Read and write  (analyze + commit on PR branches)
 * - Repository → Pull requests: Read and write  (open/track PRs; existing publishing policy)
 *
 * Do not request extra permissions unless a verified platform capability needs them.
 * Document every additional permission and why.
 *
 * URLs:
 * - Setup URL (callback after install): `{APP_ORIGIN}/api/portal/github/callback`
 * - Webhook URL: `{APP_ORIGIN}/api/webhooks/github`
 * - Webhook secret: same value as `GITHUB_APP_WEBHOOK_SECRET`
 *
 * ## Environment variables
 *
 * ```
 * GITHUB_APP_ID=123456
 * GITHUB_APP_SLUG=volo-website-connection   # from the App's public page URL
 * GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
 * GITHUB_APP_WEBHOOK_SECRET=long-random-string
 * # Optional dedicated HMAC secret for install `state` (defaults to INTEGRATION_ENCRYPTION_KEY)
 * GITHUB_APP_STATE_SECRET=
 * # Admin-only: allow legacy PAT connect via /api/portal/publishing (never customer UI)
 * GITHUB_ALLOW_PAT_FALLBACK=0
 * ```
 *
 * Never put the private key or installation tokens in `NEXT_PUBLIC_*` or browser code.
 * Never log private keys, installation tokens, authorization codes, or raw `state` values.
 *
 * ## Database
 *
 * Apply `supabase/025_github_app_connection.sql` (auth attempts + pending installs).
 * Connected installation/repo IDs live in `brand_integrations.metadata` with `authType=github_app`.
 *
 * ## Publishing
 *
 * Uses the existing `github` PublishAdapter + jobs/QA/rollback spine.
 * Tokens are minted per request via `POST /app/installations/{id}/access_tokens` and not stored.
 */

export {};
