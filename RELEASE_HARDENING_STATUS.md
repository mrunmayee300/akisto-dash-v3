# Release hardening status and agent handoff

Last updated: 2026-07-14 (Asia/Kolkata)

This file is the operational source of truth for the first Akisto dashboard security and reliability hardening release. It records both repository changes and manual changes made in external services. It intentionally contains no passwords, private keys, JWT values, spreadsheet IDs, webhook URLs, deployment IDs, or other secrets.

## Current release state

- The hardening work from commit `80267b5` was merged through PR #1 and deployed from merge commit `96c71a3` on `main`.
- The hardened frontend and backend are live in production on Render.
- A separate Render staging environment is live and uses a copied Google spreadsheet.
- Production and staging both report `{"status":"ready"}` from their backend `/ready` endpoint.
- The production dashboard is usable. Login, dashboard, PO details, and Supplier Performance were manually verified.
- The historical Google Apps Script web API deployments have been archived. Production continued working afterward, confirming the dashboard no longer depends on them.
- Retell/n8n webhook hardening is **not complete**. Do not treat the call workflow as production-safe yet.

## Repository hardening completed

The implementation in `80267b5` includes:

- Passwords sent in POST bodies and JWTs sent in `Authorization` headers.
- Legacy root `?action=...` authentication/API behavior removed.
- JWT fallback secrets and plaintext-password acceptance removed.
- Production environment validation, explicit CORS, rate limiting, request IDs, graceful shutdown, and protected cache flushing.
- Google Sheets failures return 503 instead of silently serving mock or empty data.
- Tenant-scoped sheet rows fail closed when `client_code` is missing or mismatched.
- Non-admin supplier access requires an exact buyer-email mapping.
- Dashboard and PO payload reductions, cache stampede prevention, and removal of expensive cache cloning.
- Non-overlapping frontend polling that pauses in background tabs and matches the cache interval.
- Dashboard insights use actual data instead of fabricated counts.
- UTC-midnight display-date correction.
- Retell exported workflow connection correction and dynamic `client_buyer_email` approval recipients.
- CI, environment examples, Render Blueprint, deployment guidance, security checklist, and roadmap.

See also:

- `SECURITY.md`
- `DEPLOYMENT.md`
- `HARDENING_ROADMAP.md`
- `updated_workflows/README.md`

## Verification completed

### Automated verification from the hardening pass

- 9 backend tests passed, including 20 simultaneous dashboard requests.
- Frontend lint passed without warnings.
- Production frontend build passed.
- Backend and frontend dependency audits reported zero known vulnerabilities.
- Workflow JSON and Render/CI YAML validated.
- Browser smoke tests covered login, dashboard, PO detail, and Supplier Performance.

The concurrency test uses mock data. It does not establish real Google Sheets capacity or diagnose the historical live failure.

### Manual staging verification on 2026-07-14

- Created a copied spreadsheet named `Akisto Dashboard - STAGING`.
- Converted active staging user password hashes from legacy SHA-256 to bcrypt.
- Created separate staging backend and static frontend services in the Render `Staging` environment.
- Connected staging to the copied spreadsheet using the read-only dashboard service account.
- Verified `/ready`, login, dashboard, PO detail, and Supplier Performance.
- Verified two simultaneous logged-in users could navigate without either session failing.
- Verified a non-admin user could use the correctly mapped buyer scope.

### Manual production verification on 2026-07-14

- Confirmed the merged hardening deployment was live on the existing paid Node backend.
- Corrected the production frontend to call the production backend instead of the staging backend.
- Verified `/ready`, login, dashboard, PO detail, and Supplier Performance.
- Verified a C4 non-admin user could log in with the correct C4 company. Empty C4 dashboard fields are expected because C4 has not been populated with operational data.
- Verified the dashboard continued working after all old Apps Script web deployments were archived.

## Manual security changes completed

### Google service-account credential

- Created a replacement service-account key and configured it in staging and production.
- A key accidentally exposed in a screenshot was immediately revoked.
- Created another replacement key, configured it in both environments, and verified both `/ready` endpoints.
- Deleted the older remaining key. Exactly one active user-managed key remained at completion.
- Deleted the downloaded service-account JSON files from the local machine and emptied Trash.
- The dashboard continues to use the `spreadsheets.readonly` OAuth scope.

### JWT and backend environment

- Replaced the production JWT secret after an earlier value appeared in a screenshot.
- Set production `NODE_ENV=production`.
- Removed the manually configured production `PORT`; Render now supplies it.
- Restricted production CORS to the exact Render production frontend origin, with no localhost origins, page paths, or trailing slash.
- Explicitly set these production switches to `false`:
  - `ALLOW_MOCK_DATA`
  - `ALLOW_LEGACY_QUERY_AUTH`
  - `ALLOW_LEGACY_PASSWORD_HASHES`
- Staging uses the same three disabled switches and an exact staging frontend CORS origin.

### Password migration and access roles

- The original active user rows used a shared 64-character SHA-256 hash.
- Active staging and production users were migrated to bcrypt hashes beginning with `$2b$`.
- Production currently uses one shared pilot password across active accounts. The password and hashes are not recorded here.
- Production administrator access was reduced from 10 admin rows to 2 admins and 3 regular users in the reviewed active-user set.
- C4 buyer-email mapping was confirmed and tested.
- C2 and C3 are placeholder employee/test assignments and do not currently have matching buyer-email mappings. Their Supplier Performance access should fail closed until mappings are added.

### Apps Script retirement

- The newer/copied `v3` Apps Script project had no deployments.
- The older `v3` Apps Script project had four active web-app deployments.
- All four old deployments were archived.
- The project itself was retained for now; it was not deleted.
- Production dashboard, PO detail, and Supplier Performance continued to work after archival.

## Render topology and important configuration

The Render project uses two separate services in each environment:

- Production: existing paid Node backend plus static frontend.
- Staging: free/test Node backend plus static frontend.

The existing production service names predate `render.yaml` and do not match the Blueprint names exactly. Do not blindly sync the Blueprint into the existing project; doing so can create duplicate services. Compare existing services and settings first.

The production frontend must use the production backend origin in `VITE_API_URL`. The staging frontend must use the staging backend origin. Do not cross-connect them.

Secrets remain Render environment variables and must never be copied into this repository or screenshots.

## Remaining release and security work

### 1. Retell-to-n8n webhook — blocking before real call automation

Status: **not complete; requires access to the cofounder's live n8n workflow**.

Known facts:

- The accessible sandbox workflow contains a replacement webhook node with authentication set to `None`.
- The old webhook node is deactivated, but this does not prove the live workflow is inactive.
- The cofounder's live workflow may be active because call testing was reportedly underway.
- The cofounder was asked to pause call testing until the workflow is reviewed.
- A sandbox n8n test webhook URL appeared in a screenshot. Rotate the sandbox webhook path before any future publication/activation.

Required before enabling real calls:

1. Confirm the live workflow's active/inactive status.
2. Do not send Retell directly to an unauthenticated n8n webhook.
3. Verify `X-Retell-Signature` against the exact raw request body before parsing or forwarding it.
4. Enforce Retell's timestamp/replay window and constant-time signature comparison.
5. Add persistent idempotency keyed by event type and Retell `call_id` so retries cannot duplicate updates or messages.
6. Return a successful response quickly and process slower work safely after durable receipt.
7. Rotate/rebind any exposed n8n webhook URLs, Retell API keys, OAuth credentials, and workflow credentials.
8. Test valid signatures, invalid signatures, replayed/old signatures, duplicate deliveries, and n8n failure/retry behavior.

Do not activate the exported Retell workflow merely because its JSON validates.

### 2. Replace the shared production password

Status: deferred for the small internal pilot.

- Give every real user a unique strong password and bcrypt hash.
- Communicate passwords privately; never place them in URLs, repository files, screenshots, or chat logs.
- Deactivate unused test accounts.
- Add an authenticated password-change/reset flow before onboarding external client users.

### 3. Complete buyer mappings for C2 and C3

Status: deferred because those client codes currently represent placeholder employee testing.

- Before those users need Supplier Performance access, make `Users.email` exactly match `Client info.buyer_email` or `Client info.ai_agent_buyer_email` for the same `client_code`.
- Prefer stable buyer IDs in the longer term.
- Keep the fail-closed behavior; do not add a tenant-wide fallback for unmatched non-admin users.

### 4. Finish third-party credential review

Status: partially complete.

- Google service-account and JWT credentials were rotated.
- Old Apps Script deployments were archived.
- Review and rotate/rebind live n8n, Retell, Gmail/Google OAuth, and any workflow-related credentials with the cofounder.
- Review n8n execution history and provider logs for credentials previously transmitted in query strings or embedded in workflow data.

### 5. Small repository cleanup

Status: recommended, not blocking the working deployment.

- Remove the residual `VITE_APPS_SCRIPT_URL` fallback from `react-front/src/api.js`; production already uses `VITE_API_URL`, but the fallback should not remain as a future misconfiguration path.
- Confirm whether the old Vercel frontend deployment is still public. Retire it if Render is now authoritative.
- Reconcile the manually created Render service names/settings with `render.yaml` before ever linking or syncing a Blueprint.

### 6. Longer-term items

- Add monitoring/alerts for uptime, latency, 401/403/429/5xx, Google API failures, cache behavior, heap usage, and event-loop lag.
- Add an integration test against a non-production Google spreadsheet.
- Validate sheet headers and required data types proactively.
- Replace buyer-name joins with stable IDs.
- Move operational data from Google Sheets to Postgres as usage grows.
- Consolidate duplicated frontend/backend status rules.
- Add per-client timezone configuration.
- Add pagination/server-side filtering as PO volume grows.
- Split large React components after UI behavior is covered by end-to-end tests.

## Git-history decision

The repository remains private and its Git history was intentionally not rewritten. Deleted values can remain in historical commits and provider logs, so rotation/revocation—not deletion from the current tree—was treated as the primary control. If the repository will be shared more broadly later, reconsider history rewriting after confirming every affected credential has already been rotated.

## Instructions for the next agent

1. Read this file, `SECURITY.md`, `DEPLOYMENT.md`, and `HARDENING_ROADMAP.md` before changing deployment or authentication settings.
2. Never request or reproduce secret values, password hashes, spreadsheet IDs, webhook URLs, deployment IDs, or private-key screenshots.
3. Treat the current Render production/staging configuration as working external state; verify before changing it.
4. Do not reactivate Retell/n8n call automation until raw-body signature verification and persistent idempotency are demonstrated end to end.
5. Preserve the fail-closed non-admin buyer behavior.
6. Update this document whenever a remaining item is completed or the external deployment state changes.
