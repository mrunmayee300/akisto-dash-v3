# Akisto Dashboard — Complete Capacity, CPU, Multi-Client & Scaling Guide

**Last updated:** July 10, 2026  
**Deployment:** Render Starter backend (512 MB RAM, 0.5 vCPU) + Render Static Site frontend  
**Data analyzed:** `Copy of PO_data and communication logs_Danish.xlsx` (1.49 MB, 9,187 comm-log rows)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Repository & Runtime Requirements](#3-repository--runtime-requirements)
4. [Multi-Tenant Model — Does Client Matter?](#4-multi-tenant-model--does-client-matter)
5. [CPU & Memory Model](#5-cpu--memory-model)
6. [Scenario Analysis — Best to Worst](#6-scenario-analysis--best-to-worst)
7. [User Capacity Limits](#7-user-capacity-limits)
8. [Render Starter Limitations](#8-render-starter-limitations)
9. [Scaling Playbook](#9-scaling-playbook)
10. [Optimization Roadmap](#10-optimization-roadmap)
11. [Monitoring & Load Testing](#11-monitoring--load-testing)
12. [Environment Reference](#12-environment-reference)
13. [Glossary](#13-glossary)

---

## 1. Executive Summary

| Question | Answer |
|---|---|
| **Registered users limit** | No server limit — accounts live in Google Sheets (~1,000 rows in Users tab) |
| **Safe concurrent active users (Starter)** | **5–8** across all clients combined |
| **Stretch goal** | **10–15** (mostly cache hits, mixed usage) |
| **Risk zone** | **20+** concurrent pollers, or **3+ simultaneous cache misses** |
| **Does different `client_code` change capacity?** | **Yes — partially.** Same-client users scale better than cross-client users. Raw sheet cost is shared; processed cache and CPU rebuilds are per-client. |
| **Frontend bottleneck?** | **No** — static CDN scales independently |
| **Backend bottleneck?** | **Yes** — 0.5 vCPU, 512 MB RAM, full-sheet reads, in-memory cache |

> **Concurrent active user** = someone with Dashboard or Supplier Performance open (polls every **30 seconds**). Login-only or detail-page views count much less.

---

## 2. System Architecture

```mermaid
flowchart TB
    subgraph clients [Client Tenants]
        C0[C0 - Emerald]
        C1[C1 - Biotique / Akisto]
        C2[C2 - NTPC Sipat]
    end

    subgraph users [Browser Users]
        U1[Buyer Team A]
        U2[Buyer Team B]
    end

    subgraph render [Render Cloud]
        CDN[Static Site - React CDN]
        API[Web Service - Node Express Starter 0.5 vCPU 512MB]
        MemCache[(In-Memory node-cache)]
    end

    subgraph external [External Services]
        GSheets[(Google Spreadsheet)]
        N8N[n8n Workflows]
        Gmail[Gmail]
        Claude[Claude API]
        Retell[Retell Voice]
    end

    C0 & C1 & C2 --> GSheets
    U1 & U2 --> CDN
    U1 & U2 -->|JWT sessionToken| API
    API --> MemCache
    API -->|batchGet read-only| GSheets
    N8N -->|read/write| GSheets
    N8N --> Gmail & Claude & Retell
```

### Request path

1. React app loads from Render CDN (zero backend CPU).
2. `Login.jsx` → `?action=checkCompany` + `?action=login` → JWT issued.
3. `Dashboard.jsx` / `SupplierPerformance.jsx` → poll `?action=dashboard` / `supplierPerformance` every 30s.
4. `auth.js` verifies JWT → `clientFilter.js` injects `req.clientCode` from token.
5. Controller checks **per-client** response cache → on miss, loads sheets → processes → caches → returns JSON.

### Legacy compatibility

`apps_script.js` was the original Google Apps Script API. The Node backend in `backend/src/server.js` mirrors the same `?action=` contract. Production should point `VITE_APPS_SCRIPT_URL` at the Render backend URL.

---

## 3. Repository & Runtime Requirements

### 3.1 Components

| Path | Role |
|---|---|
| `react-front/` | React 19 + Vite SPA — login, dashboard, PO detail, supplier performance |
| `backend/` | Express API — auth, sheet reads, caching, PO classification logic |
| `apps_script.js` | Legacy reference implementation (replaced by Node backend) |
| `updated_workflows/` | n8n JSON exports — ERP ingestion, email checks, stage manager, Retell |
| `Copy of PO_data and communication logs_Danish.xlsx` | Data model reference / master spreadsheet mirror |

### 3.2 Frontend routes & API load

| Route | Poll interval | Backend action |
|---|---|---|
| `/login` | None | `checkCompany`, `login` |
| `/dashboard` | **30s** | `dashboard` |
| `/supplier-performance` | **30s** | `supplierPerformance` |
| `/detail/:id` | On load | `poDetails` |
| `/supplier-detail/:id` | On load | `supplierDetail` |

### 3.3 Backend stack

```
Express + googleapis + jsonwebtoken + bcrypt + node-cache + helmet + express-rate-limit
Start: node --max-old-space-size=256 src/server.js   ← caps heap at 256 MB
```

### 3.4 Spreadsheet dimensions (July 2026)

| Sheet | Rows | Cols | C0 rows | C1 rows |
|---|---:|---:|---:|---:|
| Communication Logs | 9,187 | 224 | 11 | 0 |
| PO consolidated data | 1,371 | 64 | 15 | 3 |
| Delay Event Logs | 1,199 | 11 | 5 | 6 |
| Supplier Monthly Stats | 786 | 8 | 0 | 0 |
| Material and Supplier Master | 1,364 | 35 | 12 | 0 |
| Supplier Stats | 118 | 21 | — | — |
| Users | 1,000 | 8 | 2 users | 3 users |
| Client info | 5 | 15 | 1 | 1 |

### 3.5 Minimum production stack

| Layer | Required |
|---|---|
| Render Static Site | Yes — serves `react-front/dist` |
| Render Web Service (Starter+) | Yes — Node backend |
| Google Sheet + service account | Yes — live data |
| n8n + workflows | Required for **fresh data**, not for serving UI |
| Redis / DB | No today — recommended for scaling |

---

## 4. Multi-Tenant Model — Does Client Matter?

**Short answer: Yes, but not as much as you'd hope.** Users on different `client_code` values (C0, C1, C2) share some resources and compete on others.

### 4.1 How tenancy works in code

```
JWT payload → clientCode (e.g. C0)
clientFilter.js → req.clientCode
Controllers → filter data + cache per client
```

| Cache layer | Key pattern | Scope | Shared across clients? |
|---|---|---|---|
| Raw sheets | `raw_sheet:Communication Logs` | Full sheet rows, 120s TTL | **YES — global** |
| Dashboard response | `dashboard:C0` | Processed JSON, 60s TTL | **NO — per client** |
| Supplier performance | `suppliers_performance:C1:email@x.com` | Processed JSON, 60s TTL | **NO — per client + user** |
| PO detail | `po_details:C0:CG-123` | Per PO group, 300s TTL | **NO — per client + PO** |
| Supplier detail | `supplier_detail:C1:S17` | Per supplier, 60s TTL | **NO — per client + supplier** |
| Sheet metadata | `spreadsheet_sheets_list:{id}` | Tab names, 3600s TTL | **YES — global** |

### 4.2 What is the SAME regardless of client

| Resource | Why it doesn't split by client |
|---|---|
| **Google Sheets fetch size** | `batchGet` always pulls `A1:IZ` for entire Communication Logs (9,187 rows) |
| **Raw cache memory** | One copy of full sheets in RAM for all tenants |
| **Row scan during parse** | `getObjects()` still iterates every row; skips non-matching `client_code` |
| **Instance CPU/RAM ceiling** | 0.5 vCPU and 512 MB shared by C0 + C1 + C2 users |
| **Google Sheets API quota** | 300 reads/min per GCP project — shared with n8n |

### 4.3 What DIFFERS by client

| Resource | How it differs |
|---|---|
| **Processed output size** | C0 has ~15 PO lines; a large client could have hundreds — smaller JSON per cache entry |
| **Per-client CPU on rebuild** | Merge/classify loop runs on that client's PO rows only (small for C0, larger for busy clients) |
| **Memory for processed caches** | Each active client adds `dashboard:{code}` + supplier caches (~5–30 MB each) |
| **Cache hit sharing** | Users on **same client** share one `dashboard:C0` entry — **best case** |
| **Supplier performance cache** | Also keyed by user email (buyer filter) — two buyers on same client may need **two** caches |

### 4.4 Cross-client comparison matrix

| Scenario | Sheets API calls | CPU per rebuild | Memory | User scaling |
|---|---|---|---|---|
| **3 users, all C0** | Low (shared raw cache) | 1× rebuild serves all 3 | 1 dashboard cache | **Best** |
| **3 users: 2×C0 + 1×C1** | Low | Up to 2× rebuilds (C0 + C1) | 2 dashboard caches | **Good** |
| **6 users: 2 per C0/C1/C2** | Low | Up to 3× rebuilds on expiry | 3 dashboard caches | **Moderate** |
| **10 users, all different clients** | Low raw sharing | Up to N rebuilds queued | N caches — RAM pressure | **Worst** |

### 4.5 Key insight

```
Adding more CLIENTS hurts differently than adding more USERS.

More users, SAME client  →  mostly free (shared processed cache)
More users, DIFFERENT clients  →  more processed caches + queued CPU rebuilds
More rows in Communication Logs  →  hurts EVERYONE equally (dominant cost)
```

A small client (C0, 11 comm-log rows) does **not** get a lightweight backend path today. The server still loads and scans all 9,187 comm-log rows on every raw-cache miss.

---

## 5. CPU & Memory Model

### 5.1 Render Starter instance budget

| Resource | Total available | Per-user allocation |
|---|---|---|
| CPU | **0.5 vCPU** (shared) | **None** — no per-user cap |
| RAM | **512 MB** (shared) | **None** |
| Node heap cap | **256 MB** (self-imposed in `package.json`) | Effective ceiling is half the container |

**Max CPU any single request can use:** up to **~100% of 0.5 vCPU** during CPU-bound processing (Node is single-threaded — one heavy job blocks others).

### 5.2 CPU cost per request type

| Request | Cache state | CPU time | % of 0.5 vCPU during work |
|---|---|---:|---|
| Dashboard poll | Processed cache **hit** | 5–20 ms | ~1–4% brief spike |
| Dashboard poll | Processed miss, raw cache **hit** | 100–800 ms | 20–80% for 0.1–0.8s |
| Dashboard poll | Full miss (cold) | 300 ms–2 s | 80–100% for 0.3–2s |
| Supplier performance | Full miss | 200 ms–1.5 s | 60–100% |
| PO detail | Miss | 100–500 ms | 30–70% |
| Login | Always fresh | 50–200 ms | 10–40% |

*I/O wait (Google Sheets network call) uses little CPU — the server is idle while waiting.*

### 5.3 CPU per active user (averaged over time)

Assumptions: dashboard open, 30s polling, ~50% processed cache hits.

| Active users | Est. avg instance CPU | Peak CPU spikes |
|---:|---|---|
| 1 | 3–7% | 80–100% on cache expiry |
| 5 (same client) | 10–25% | 80–100% every ~60s |
| 5 (3 clients) | 15–35% | 100% + queued rebuilds |
| 10 (same client) | 20–40% | Frequent 100% |
| 10 (5 clients) | 30–60% | Sustained 100%, multi-second delays |
| 15+ | 50–100% sustained | Timeouts, 5xx errors |

### 5.4 Memory footprint

| Component | Size | Client-dependent? |
|---|---:|---|
| Node + Express baseline | 40–60 MB | No |
| Raw Communication Logs cache | 80–150 MB | **No — always full sheet** |
| Other raw sheets | 20–40 MB | No |
| Processed `dashboard:{client}` | 5–30 MB each | **Yes — per active client** |
| Processed supplier caches | 2–15 MB each | Per client + user |
| GC / spike overhead | 50–100 MB | No |

| Active clients with warm caches | Est. total RAM |
|---:|---|
| 1 client | 150–250 MB |
| 3 clients | 200–320 MB |
| 5 clients | 250–400 MB |
| + heap cap at 256 MB | **OOM likely at 2–3 clients on cold start** |

---

## 6. Scenario Analysis — Best to Worst

Ranked from lowest load to highest risk.

---

### Scenario 1 — BEST: Single user, single client, warm caches

```
1 buyer from C0, dashboard open, caches warm >2 min
```

| Metric | Value |
|---|---|
| Response time | **< 50 ms** |
| CPU | < 5% average |
| RAM | ~180 MB stable |
| Sheets API | 0 calls/min |
| Concurrent capacity headroom | High — instance mostly idle |

**Why it's best:** Processed `dashboard:C0` cache hit on every poll. No sheet fetch, no rebuild.

---

### Scenario 2: Multiple users, SAME client, warm caches

```
5 buyers from C0, all on dashboard, caches warm
```

| Metric | Value |
|---|---|
| Response time | **< 50 ms** for all 5 |
| CPU | 5–15% average |
| RAM | ~180 MB (one `dashboard:C0` entry) |
| Effective users per client | **Scales well — 5 users ≈ 1 user** |

**Why it's good:** All 5 share one processed cache. Polling multiplies requests but not compute.

---

### Scenario 3: Users on detail pages only (no polling)

```
8 users browsing PO Detail / Supplier Detail, not dashboard
```

| Metric | Value |
|---|---|
| Response time | 200 ms–1s per page load |
| CPU | Bursty, then idle |
| Safe user count | **15–20** brief concurrent loads |

**Why it's fine:** No 30s polling loop. Load is sporadic.

---

### Scenario 4: Mixed — same client, dashboard + supplier performance

```
3 users C0: 2 on dashboard + 1 on supplier performance
```

| Metric | Value |
|---|---|
| Requests/min | ~6 (4 dashboard + 2 supplier) |
| Cache entries | `dashboard:C0` + `suppliers_performance:C0:email` |
| CPU | 15–25% average |
| Safe? | **Yes** |

---

### Scenario 5: MODERATE — multiple clients, warm raw cache, cold processed cache

```
4 users: 2×C0 + 2×C1, all on dashboard, processed cache just expired
```

| Metric | Value |
|---|---|
| What happens | Raw sheets served from cache; C0 and C1 each rebuild dashboard |
| CPU | 2 sequential rebuilds queued → **0.5–1.5s** per user |
| RAM | 2 dashboard caches stored |
| Safe? | **Acceptable** — occasional slow poll |

---

### Scenario 6: Multiple clients, multiple buyers per client

```
9 users: 3 clients × 3 buyers each, all polling dashboard
```

| Metric | Value |
|---|---|
| Requests/min | 18 |
| Processed caches needed | 3 (`dashboard:C0`, `dashboard:C1`, `dashboard:C2`) |
| CPU average | 30–50% |
| RAM | 220–350 MB |
| Safe? | **Stretch zone** — works if caches stay warm |

---

### Scenario 7: STRESS — cold start after deploy

```
Backend just deployed, all caches empty
5 users (any client mix) hit dashboard within 30s
```

| Metric | Value |
|---|---|
| What happens | 1× Sheets `batchGet` + N× client rebuilds queued |
| Response time | **3–10s** for early users |
| CPU | 100% sustained 5–15s |
| RAM spike | 280–400 MB+ → **OOM risk** with 256 MB heap cap |
| Safe? | **No** — expect errors on first wave |

---

### Scenario 8: HIGH RISK — cache flush during business hours

```
POST /api/cache/flush (unauthenticated!) + 10 active pollers
```

| Metric | Value |
|---|---|
| What happens | Thundering herd — all pollers miss simultaneously |
| CPU | 100% for extended period |
| Safe? | **No** — protect this endpoint immediately |

---

### Scenario 9: WORST — many clients, many users, data growth, dual polling

```
15 users across 5 clients
8 on dashboard + 4 on supplier performance + 3 browsing details
Communication Logs grown to 20,000+ rows
```

| Metric | Value |
|---|---|
| Requests/min | ~24+ |
| Processed caches | 5 dashboard + up to 5 supplier caches |
| CPU | 70–100% sustained |
| RAM | 350–500 MB → exceeds heap cap |
| Response time | 3–15s, frequent 500 errors |
| Sheets API | Still OK if raw cache holds; processing is the killer |
| Safe? | **Unacceptable on Starter** |

---

### Scenario 10: ABSOLUTE WORST — n8n peak + dashboard peak + cold cache

```
Morning: n8n Stage Manager + Email Check workflows hammer Sheets API
Simultaneously: 10 dashboard users, cache expired, 3 clients
```

| Failure modes | |
|---|---|
| CPU | 100%, request queue backs up |
| RAM | OOM crash → all users down |
| Sheets API | Possible 429 rate limits (300/min shared with n8n) |
| Recovery | Render restarts container → another cold start wave |

---

### Scenario summary table

| Rank | Scenario | Users | Clients | Safe on Starter? |
|:---:|---|---:|---:|:---:|
| 1 | Single user, warm cache | 1 | 1 | ✅ |
| 2 | Multi-user, same client, warm | 5–8 | 1 | ✅ |
| 3 | Detail pages only | 15+ | any | ✅ |
| 4 | Same client, dashboard + supplier | 3–5 | 1 | ✅ |
| 5 | Multi-client, warm raw cache | 4–8 | 2–3 | ⚠️ |
| 6 | 3 buyers × 3 clients | 9 | 3 | ⚠️ |
| 7 | Cold start after deploy | 5+ | any | ❌ |
| 8 | Cache flush + pollers | 10+ | any | ❌ |
| 9 | 15 users, 5 clients, dual poll | 15 | 5 | ❌ |
| 10 | n8n peak + cold cache + multi-client | 10+ | 3+ | ❌ |

---

## 7. User Capacity Limits

### 7.1 By deployment shape (Render Starter)

| Deployment shape | Safe concurrent active | Stretch | Hard limit |
|---|---:|---:|---:|
| **1 client, dashboard only** | 8 | 12–15 | ~20 |
| **1 client, dashboard + supplier perf** | 5 | 8–10 | ~15 |
| **2–3 clients, mixed usage** | 5 | 8–10 | ~12 |
| **5+ clients active simultaneously** | 3 | 5–6 | ~8 |
| **Detail-page-only traffic** | 20+ | 30+ | bandwidth-bound |

### 7.2 Rules of thumb

1. **Same client scales better** — prefer onboarding one team fully before adding many tenants.
2. **Client count matters more than user count** when caches expire together.
3. **Data row growth hurts all clients equally** — Communication Logs size is the dominant factor.
4. **Sequential daily users** (not overlapping) — 30–50+ registered users is fine.
5. **Supplier performance per buyer** creates extra cache entries — multi-buyer clients cost more than multi-viewer clients.

### 7.3 What does NOT change with client

- Render instance size (always 0.5 vCPU total)
- Full-sheet Google API fetch on raw cache miss
- 30s polling rate per open tab
- 256 MB heap cap

---

## 8. Render Starter Limitations

### 8.1 Compute

| Limitation | Impact |
|---|---|
| 0.5 vCPU, single instance | One heavy rebuild blocks all users |
| 512 MB RAM | Tight for 9k-row sheets + multi-client caches |
| 256 MB heap cap in start script | Premature OOM before container limit |
| No autoscaling | Cannot add instances on traffic spikes |
| No horizontal scaling | Starter = exactly 1 instance |
| Shared CPU | Noisy neighbor effect on host |

### 8.2 Platform

| Limitation | Impact |
|---|---|
| In-memory cache only | Every deploy = cold start pain |
| No persistent disk | Cannot use local SQLite/file cache |
| No built-in Redis | Must use external Upstash/Redis addon |
| Outbound bandwidth metering | Large JSON × polling = minor cost |
| No APM included | Blind to cache miss spikes without tooling |

### 8.3 Application-level

| Limitation | Impact |
|---|---|
| Full-sheet reads | Client with 11 rows pays same cost as 9,000 |
| 30s polling | Linear request growth per open tab |
| Unauthenticated cache flush | Operational risk |
| Rate limit only on `/api/*` | Legacy `/?action=` routes unprotected |
| JWT in query string | Logged in access logs / referrer leakage |

### 8.4 What Starter does well

- Always-on (no Free-tier 15-min spin-down)
- ~$7/month — good for pilot
- Simple GitHub deploy
- Sufficient for **one client, ≤8 concurrent buyers**

---

## 9. Scaling Playbook

### Tier 0 — Pilot (current): Render Starter

```
Capacity: 5–8 concurrent active users, 1–2 clients
Cost: ~$7/mo backend + free/cheap static site
Action: None required
```

### Tier 1 — Quick wins (same Starter, 2–3× headroom)

| Change | Effort | Gain |
|---|---|---|
| Remove or raise `--max-old-space-size=256` → `384` | 1 line | Fewer OOM crashes |
| Increase cache TTL (60→120s dashboard, 120→300s raw) | Small | 2× fewer rebuilds |
| Poll only when tab visible + 60s interval | Small | 2–4× fewer requests |
| Protect `/api/cache/flush` with auth | Small | Eliminate thundering herd |
| Add `compression` middleware | Small | Lower bandwidth, faster transfer |

**Expected result:** 10–12 concurrent users (1 client) or 8–10 (2–3 clients).

### Tier 2 — Render Standard + Redis

```
Upgrade: 2 GB RAM, 1 vCPU (~$25/mo)
Add: Upstash Redis for shared cache across restarts
Capacity: 15–25 concurrent, 3–5 clients
```

| Change | Gain |
|---|---|
| Standard instance | 2× CPU, 4× RAM headroom |
| Redis raw + processed cache | Survives deploys; enables multi-instance later |
| Stagger cache TTL per client (C0=60s, C1=65s…) | Avoids simultaneous expiry |

### Tier 3 — Data layer optimization

```
Capacity: 30–50 concurrent, 5+ clients
Cost: Standard + Redis + dev time
```

| Change | Gain |
|---|---|
| Per-client view tabs in Google Sheets (maintained by n8n) | Fetch 200 rows instead of 9,000 |
| Narrow column ranges (`A1:AZ` not `A1:IZ`) | Smaller payloads |
| Paginated dashboard API | Fast first paint, load tabs on demand |
| Pre-aggregated summary sheet (counts per client) | O(1) KPI reads |

### Tier 4 — Database read replica

```
Capacity: 50–100+ concurrent
Cost: Standard/Pro + managed Postgres (~$50–100/mo total)
```

```
n8n → Google Sheets (source of truth)
      ↓ scheduled sync every 1–5 min
    Postgres (read replica)
      ↓
    Node backend (SQL queries, indexed by client_code)
```

| Gain |
|---|
| Query only `WHERE client_code = 'C0'` — true per-tenant isolation |
| Indexed lookups — O(log n) not O(n) |
| Decouples dashboard from Sheets API quota |
| Enables connection pooling, read replicas |

### Tier 5 — Enterprise

```
Capacity: 100+ concurrent, many clients
```

- Render Pro + autoscaling (2+ instances)
- Redis cluster
- Postgres primary + replica
- WebSocket push (replace polling — notify only on n8n data change)
- Separate GCP project for dashboard vs n8n Sheets quota
- CDN edge caching for semi-static per-client summaries

### Scaling decision tree

```
How many concurrent active users?
│
├─ ≤ 8, 1–2 clients → Stay on Starter + Tier 1 quick wins
│
├─ 8–20, 2–4 clients → Standard + Redis (Tier 2)
│
├─ 20–50 → Tier 3 data optimization required
│
└─ 50+ → Tier 4 database replica (architectural change)
```

---

## 10. Optimization Roadmap

### Immediate (this week)

- [ ] Raise heap cap to 384 MB
- [ ] Increase cache TTLs
- [ ] Visibility-aware polling in `Dashboard.jsx` + `SupplierPerformance.jsx`
- [ ] Auth-gate cache flush endpoint
- [ ] Add cache hit/miss logging

### Short-term (this month)

- [ ] Create slim per-client comm-log view sheets via n8n
- [ ] Add `compression` middleware
- [ ] Extend rate limiting to `/?action=` routes
- [ ] Move JWT from query string to `Authorization` header
- [ ] Set up Render memory/CPU alerts

### Medium-term (quarter)

- [ ] Upstash Redis integration
- [ ] Upgrade to Render Standard
- [ ] Paginated dashboard endpoints
- [ ] Load test with k6 (5/10/20 VUs per client mix)

### Long-term

- [ ] Sheets → Postgres sync pipeline
- [ ] WebSocket or SSE for data push
- [ ] Per-client deploy option (dedicated small instances for enterprise clients)

---

## 11. Monitoring & Load Testing

### Metrics to watch

| Metric | Warning | Critical |
|---|---|---|
| Memory % | > 70% for 5 min | > 85% |
| CPU % | > 60% sustained | > 90% sustained |
| p95 response time | > 2s | > 5s |
| HTTP 5xx rate | > 1% | > 5% |
| Cache miss rate | > 40% | > 60% |
| Sheets API 429s | Any | Sustained |

### Suggested load test (k6)

```javascript
// Test A: 5 users, same client (C0)
// Test B: 5 users, 3 clients (2+2+1)
// Test C: 10 users, 5 clients
// Each: dashboard poll every 30s for 5 minutes
// Measure: p95 latency, error rate, Render memory graph
```

### Log lines to add

```
[Cache HIT]  dashboard:C0
[Cache MISS] dashboard:C1 — rebuilding (raw_sheet: HIT)
[Cache MISS] dashboard:C0 — rebuilding (raw_sheet: MISS) — fetching Sheets API
[Perf] dashboard:C0 built in 842ms — 15 POs, scanned 9187 comm rows
```

---

## 12. Environment Reference

### Frontend (build-time)

```env
VITE_APPS_SCRIPT_URL=https://your-backend.onrender.com
```

### Backend (Render)

```env
PORT=10000
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=1-og69jKI34UReQJX9nCLEtxuEZ-WJsn_ao0x5SPASrE
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=24h
CORS_ALLOWED_ORIGINS=https://your-frontend.onrender.com
NODE_ENV=production
```

### Local dev

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd react-front
echo "VITE_APPS_SCRIPT_URL=http://localhost:5000" > .env.local
npm install && npm run dev
```

---

## 13. Glossary

| Term | Definition |
|---|---|
| `client_code` | Tenant ID (C0, C1, C2) — all data filtered by this |
| Concurrent active user | User with polling page open now |
| Processed cache | Computed dashboard JSON per client |
| Raw cache | Full sheet rows from Google Sheets |
| Cache miss | Data not in cache — requires CPU (+ maybe API) |
| Comm-log | Communication Logs sheet — largest data source |
| Polling | Frontend auto-fetch every 30s |
| Thundering herd | Many users miss cache simultaneously after flush/expiry |

---

## Appendix A — Capacity cheat sheet

```
┌────────────────────────────────────────────────────────────────────────┐
│                    RENDER STARTER CAPACITY CHEAT SHEET                 │
├────────────────────────────────────────────────────────────────────────┤
│  Instance:     0.5 vCPU │ 512 MB RAM │ 256 MB heap cap │ 1 instance   │
├────────────────────────────────────────────────────────────────────────┤
│  BEST CASE:    1 client, 5–8 users, warm cache        → <50ms        │
│  GOOD CASE:    2–3 clients, 5–8 users total           → <500ms       │
│  STRETCH:      3 clients, 10–12 users                 → 1–3s spikes  │
│  BAD CASE:     cold start + 5 users                   → 3–10s        │
│  WORST CASE:   5 clients, 15 users, dual poll         → crashes      │
├────────────────────────────────────────────────────────────────────────┤
│  Same client = users share cache (scale users cheaply)                 │
│  Diff clients = separate caches (scale clients costly)                 │
│  Data growth = hurts everyone (fix with per-client views or DB)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

*Guide based on codebase analysis (backend, react-front, apps_script.js, updated_workflows), Danish spreadsheet export (July 2026), and Render/Google published specifications. Validate with k6 load tests against your live Render deployment.*
