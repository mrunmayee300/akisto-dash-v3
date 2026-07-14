# Deployment

Keep the frontend and backend as two Render services in the same Render project and Git repository. They have different scaling and security characteristics: the frontend is a static site served from Render's CDN, while the backend is a long-running Node web service. Combining them into one process would save little and make deployments, caching, and future scaling less flexible.

`render.yaml` describes the intended production topology. It does not change an existing Render deployment until a Blueprint is linked or synced. If services already exist, generate a Blueprint from those services first and compare service names and settings before adopting this file; otherwise Render can create duplicate services.

## Required production values

Configure these values in Render rather than committing them:

- Backend: `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `CORS_ALLOWED_ORIGINS`.
- Frontend: `VITE_API_URL`, set to the backend's public HTTPS origin.
- `CORS_ALLOWED_ORIGINS` must be the frontend's exact HTTPS origin. Add comma-separated origins only when each is intentionally trusted.

Render can generate `JWT_SECRET` and `CACHE_ADMIN_TOKEN`. Existing deployments must set or rotate these manually because `sync: false` and generated values are not retroactively applied to an existing service.

## Release sequence

1. Create a staging environment or preview services from the hardening branch.
2. Set the backend secrets and frontend/backend origins.
3. Run `npm test` in `backend`, then `npm run lint` and `npm run build` in `react-front`.
4. Deploy the frontend first, because the previous backend already exposes the REST routes used by the updated client. Verify requests use `/api/...` and no password or JWT appears in a URL.
5. Deploy the backend and verify `/health`, login, dashboard, PO detail, and supplier pages.
6. Watch 401, 403, 429, 5xx, latency, and memory logs before promoting to production.

## Capacity direction

The next scaling milestone is moving operational data from Google Sheets to Postgres. EC2 does not remove the Sheets quota, full-sheet read, cache consistency, or data-model limits. Stay on Render while usage is modest; use a paid always-on backend instance, measure real traffic, and migrate the data layer before moving to raw infrastructure.
