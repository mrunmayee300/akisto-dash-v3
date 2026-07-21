# Hardening roadmap

## Release blockers

- Rotate credentials and URLs listed in `SECURITY.md`; repository cleanup does not invalidate exposed values.
- Convert every active user password hash to bcrypt, then keep all legacy-auth switches disabled.
- Test this branch in a separate Render staging environment with a copy of the spreadsheet.
- Secure the Retell-to-n8n webhook using raw-body signature verification and persistent idempotency before reactivating the exported workflow.
- Confirm every non-admin user has a unique buyer email mapping. Supplier access now fails closed when that mapping is absent.

## Next production improvements

- Add external error tracking and uptime alerts. Track request count, p50/p95/p99 latency, 401/403/429/5xx rates, Google API failures, cache hit rate, heap usage, and event-loop lag.
- Add an integration test against a non-production Google spreadsheet. The current tests use explicit mock mode and prove authorization/concurrency behavior, not Google quota or live data quality.
- Add schema validation for required sheet headers and data types at startup or via a scheduled health job. Empty or renamed sheets should alert before users discover them.
- Replace buyer-name joins with immutable buyer IDs across Users, Client info, supplier, PO, and workflow data.
- Make timezone a client setting. Several display and six-month calculations still assume `America/New_York`.
- Add pagination or server-side filtering for large dashboard payloads before PO volume grows substantially.

## Data-layer migration

Google Sheets remains the primary scalability and consistency limit. It is acceptable for pilots, but moving the Node process to EC2 would not fix full-sheet reads, API quotas, weak relational constraints, or concurrent n8n writes.

Migrate operational tables to Postgres in phases:

1. Define schemas and stable IDs for clients, users, buyers, suppliers, POs, communications, and delay events.
2. Mirror Sheets/n8n writes into Postgres and reconcile counts and checksums.
3. Switch dashboard reads to Postgres behind a feature flag.
4. Make Postgres authoritative, retaining Sheets only for exports/operations that still need it.
5. Add Redis only when multiple API instances or cross-instance invalidation are actually required.

## Landing page

The landing page is not present in this branch. Add it as the public `/` route and move the authenticated dashboard under `/dashboard` when its source/design is available. Submit leads through a small server endpoint with validation, rate limiting, bot protection, idempotency, and a strict allowed-field list.

Do not give the dashboard's read-only operational service account write access. Use a separate credential and separate leads spreadsheet so a public form compromise cannot read or modify procurement data. Postgres is preferable once lead volume or CRM workflows become important.

## Maintainability

- Move PO status/bucketing rules to one tested source of truth; backend and frontend implementations can still drift.
- Split the largest React pages into focused components and hooks after behavior is covered by UI tests.
- Remove or archive older design and migration documents after stakeholders confirm they are no longer needed.
- Add end-to-end tests for login, dashboard, PO details, supplier scope, token expiry, and logout before larger UI changes.
