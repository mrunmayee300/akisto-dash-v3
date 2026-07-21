# Security release checklist

The repository previously contained a deployed Apps Script URL, URL-based test credentials, personal test accounts, session-token logging scripts, workflow pinned data, and hardcoded notification addresses. Removing them from the current tree does not remove them from Git history or third-party logs.

Before production release:

1. Rotate the Google service-account key, JWT secret, Apps Script deployment, n8n webhook URLs/secrets, and any credentials referenced by exported workflows.
2. Reset passwords for every account that existed in repository fixtures or was used by the deleted debug scripts.
3. Review GitHub, Render, Google, n8n, browser, and proxy logs for credentials that were previously transmitted in query strings.
4. Purge or rewrite repository history if this repository will be shared more broadly. Rotation is still required even after history rewriting.
5. Rebind n8n credentials after importing sanitized workflow exports. Never commit credential values or production execution data.
6. Keep `ALLOW_MOCK_DATA`, `ALLOW_LEGACY_QUERY_AUTH`, and `ALLOW_LEGACY_PASSWORD_HASHES` disabled in production.

Before disabling legacy password hashes, inspect the `Users` sheet. Every active `password_hash` must be a bcrypt hash beginning with `$2a$` or `$2b$`. Reset any account that still uses SHA-256 or plain text; hashes cannot be converted without the original password. `ALLOW_LEGACY_PASSWORD_HASHES=true` exists only as a short migration window for SHA-256 and must not become the permanent configuration. Plain-text passwords are never accepted.

Google Sheets should remain read-only for the dashboard service account. The future landing-page form should use a separate write-only integration or service account and a separate leads spreadsheet, with server-side validation, rate limiting, idempotency, and bot protection.
