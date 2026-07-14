# Akisto Dashboard — Go Backend & Optimization Options Guide

**Last updated:** July 10, 2026  
**Purpose:** Evaluate rewriting the backend in Go, what problems it would actually solve, what it would not solve, and which alternatives may deliver better ROI than a language rewrite.

**Context:** Current stack is Node.js + Express on Render Starter (512 MB RAM, 0.5 vCPU), reading Google Sheets with in-memory `node-cache`, serving a React frontend that polls every 30 seconds.

**Related doc:** See `dashboard_capacity_and_deployment_guide.md` for full capacity, CPU, and multi-client analysis.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Node.js Bottlenecks](#2-current-nodejs-bottlenecks)
3. [How Go Would Help](#3-how-go-would-help)
4. [Proposed Go Backend Architecture](#4-proposed-go-backend-architecture)
5. [Migration Path](#5-migration-path)
6. [Render Deployment for Go](#6-render-deployment-for-go)
7. [Other Optimization Options (Ranked by ROI)](#7-other-optimization-options-ranked-by-roi)
8. [Decision Matrix](#8-decision-matrix)
9. [Recommended Strategy](#9-recommended-strategy)
10. [Go Rewrite — Risks & Gotchas](#10-go-rewrite--risks--gotchas)
11. [Porting Checklist](#11-porting-checklist)
12. [Summary](#12-summary)

---

## 1. Executive Summary

| Question | Answer |
|---|---|
| **Should you rewrite in Go?** | **Not as the first move.** Architectural fixes (data layer, caching, polling) give 5–10× more capacity for far less effort. |
| **When does Go make sense?** | After Tier 1–2 optimizations, if you still need **2–4× request throughput** on the same Render plan, or want a smaller memory footprint for concurrent requests. |
| **Best overall optimization path** | Fix data access → Redis → Render Standard → then consider Go if still bottlenecked. |
| **Go on Render Starter (0.5 vCPU)?** | Modest gains (~20–40% better under concurrent I/O). **Not a magic fix** for full-sheet reads. |
| **Go on Render Standard (1 vCPU)?** | Meaningful gains (~2–3× concurrent request handling vs Node). |

**Bottom line:** Go is a **runtime upgrade**, not an **architecture fix**. The biggest problems are *what* you load (9,187 comm-log rows for every client), *how often* you load it (30s polling), and *where* you cache it (ephemeral in-process memory).

---

## 2. Current Node.js Bottlenecks

From the codebase and capacity analysis:

| Bottleneck | Root cause in code | Go rewrite fixes this? |
|---|---|:---:|
| Full Communication Logs load | `sheets.service.js` fetches `A1:IZ` for entire sheet | ❌ No — unless you change the query |
| Per-client filter after full load | `getObjects()` scans all rows | ⚠️ Partially — faster scan, same work |
| 256 MB heap cap | `package.json` `--max-old-space-size=256` | ✅ Yes — Go uses less RAM per request |
| Single-threaded CPU work | Node event loop blocks on classify/merge | ✅ Yes — goroutines + true parallelism on multi-core |
| In-memory cache lost on deploy | `node-cache` in-process | ❌ No — need Redis regardless of language |
| 30s frontend polling | `Dashboard.jsx`, `SupplierPerformance.jsx` | ❌ No — frontend change |
| Multi-client cache expiry | Separate `dashboard:{clientCode}` keys | ❌ No — cache design issue |
| Google Sheets API latency | Network I/O waiting | ⚠️ Partially — Go handles concurrent waits better |

**Conclusion:** ~70% of the capacity problem is **architecture and configuration**. ~30% is **runtime efficiency**.

---

## 3. How Go Would Help

### 3.1 What Go does better than Node for this workload

| Advantage | Why it matters for Akisto |
|---|---|
| **Lower memory per request** | Parsing 9k rows into structs uses less RAM than JS objects. Helps avoid OOM on 512 MB Starter. |
| **Goroutines for concurrent I/O** | While one request waits on Google Sheets API, others can process. Node does this too (async), but Go handles **many** concurrent requests with less overhead. |
| **Faster CPU-bound parsing** | Filtering, merging PO + comm rows, JSON serialization — typically **2–5× faster** than Node for same logic. |
| **Compiled binary** | No V8 heap cap issue. Single binary deploy on Render. Predictable memory. |
| **True multi-core use** | On Standard (1 vCPU) or Pro (2 vCPU), Go can parse sheets in parallel across cores. Node needs `worker_threads` for this. |
| **Smaller container footprint** | Go binary ~10–20 MB vs Node + `node_modules` ~100+ MB. Faster cold starts. |

### 3.2 Estimated capacity improvement (same Render Starter, same architecture)

| Metric | Node.js (today) | Go (same logic, no arch changes) |
|---|---|---|
| Safe concurrent users (1 client) | 5–8 | **7–11** |
| Safe concurrent users (3 clients) | 5 | **6–8** |
| Cold start recovery | 3–10s, OOM risk | **2–6s**, lower OOM risk |
| Memory at steady state | 180–280 MB | **100–180 MB** |
| CPU per dashboard rebuild | 300ms–2s | **100ms–800ms** |

These are estimates. Go helps, but you still hit a wall at ~12–15 concurrent pollers on Starter because **0.5 vCPU is the hard ceiling**.

### 3.3 What Go would NOT fix

- Loading all 9,187 comm-log rows for a client with 11 rows
- Cache lost on every deploy (without Redis)
- 30-second polling multiplying requests
- Google Sheets API 300 reads/min quota shared with n8n
- Multi-client processed cache expiry storms
- Unauthenticated `/api/cache/flush` endpoint

---

## 4. Proposed Go Backend Architecture

### 4.1 Project structure (mirror of current Node layout)

```
backend-go/
├── cmd/
│   └── server/
│       └── main.go              # Entry point, HTTP server
├── internal/
│   ├── config/
│   │   └── config.go            # Env vars (PORT, JWT, Google creds)
│   ├── middleware/
│   │   ├── auth.go              # JWT from Bearer / sessionToken query
│   │   ├── cors.go
│   │   ├── ratelimit.go
│   │   └── clientfilter.go      # Inject clientCode from JWT
│   ├── handlers/
│   │   ├── auth.go              # checkCompany, login
│   │   ├── dashboard.go         # dashboard action
│   │   ├── po.go                # poDetails
│   │   └── supplier.go          # supplierPerformance, supplierDetail
│   ├── services/
│   │   ├── sheets.go            # Google Sheets batchGet + caching
│   │   ├── cache.go             # Redis or in-memory (go-cache)
│   │   ├── auth.go              # bcrypt + JWT
│   │   └── classifier.go        # isOnTrack, getPoStatusBucket, etc.
│   └── models/
│       ├── po.go
│       ├── comm.go
│       └── supplier.go
├── go.mod
├── go.sum
└── Dockerfile
```

### 4.2 API compatibility — zero frontend changes

The React app calls:

```
GET ${VITE_API_URL}/api/dashboard with Authorization: Bearer {token}
POST ${VITE_API_URL}/api/auth/login with a JSON request body
```

The Go server must preserve this **exact contract**:

| Action | Auth | Response shape |
|---|---|---|
| `checkCompany` | Public | `{ success, companyName }` |
| `login` | Public | `{ success, token, email, role, userName, userRole, companyName }` |
| `dashboard` | JWT | `{ openPOs, onTrack, needsAttention, awaitingReply, generatedAt }` |
| `poDetails` | JWT | `{ success, header, supplier, lineItems, timeline, ... }` |
| `supplierPerformance` | JWT | `{ success, suppliers, kpis, trendData, delaySummary }` |
| `supplierDetail` | JWT | `{ success, supplierMeta, kpis, trendData, ... }` |

Port the business logic from:

- `dashboard.controller.js` → `internal/services/classifier.go`
- `sheets.service.js` → `internal/services/sheets.go`
- `auth.service.js` → `internal/services/auth.go`

### 4.3 Go library equivalents

| Node package | Go replacement |
|---|---|
| `express` | `net/http` + `chi` or `gin` or `echo` |
| `googleapis` | `google.golang.org/api/sheets/v4` |
| `jsonwebtoken` | `github.com/golang-jwt/jwt/v5` |
| `bcrypt` | `golang.org/x/crypto/bcrypt` |
| `node-cache` | `github.com/patrickmn/go-cache` (in-memory) or `github.com/redis/go-redis/v9` |
| `helmet` | Built-in headers middleware or `github.com/unrolled/secure` |
| `express-rate-limit` | `github.com/ulule/limiter/v3` |
| `cors` | `github.com/rs/cors` |
| `dotenv` | `github.com/joho/godotenv` or Render env vars directly |

### 4.4 Example: concurrent sheet fetch in Go

```go
// Conceptual — multiple sheets fetched in parallel
func (s *SheetsService) FetchSheets(ctx context.Context, names []string) (map[string][][]string, error) {
    results := make(map[string][][]string)
    var mu sync.Mutex
    var wg sync.WaitGroup
    errCh := make(chan error, len(names))

    for _, name := range names {
        wg.Add(1)
        go func(sheetName string) {
            defer wg.Done()
            rows, err := s.fetchOne(ctx, sheetName)
            if err != nil {
                errCh <- err
                return
            }
            mu.Lock()
            results[sheetName] = rows
            mu.Unlock()
        }(name)
    }
    wg.Wait()
    close(errCh)
    return results, nil
}
```

Node's `getMultipleSheets` already batches via `batchGet` (one API call). Go's win is in **parallel processing after fetch**, not necessarily parallel API calls.

### 4.5 Example: per-client dashboard handler

```go
func (h *DashboardHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
    clientCode := r.Context().Value("clientCode").(string)

    if cached, ok := h.cache.Get("dashboard:" + clientCode); ok {
        json.NewEncoder(w).Encode(cached)
        return
    }

    result, err := h.service.BuildDashboard(r.Context(), clientCode)
    if err != nil {
        http.Error(w, `{"success":false,"message":"Failed to load dashboard data"}`, 500)
        return
    }
    h.cache.Set("dashboard:"+clientCode, result, 60*time.Second)
    json.NewEncoder(w).Encode(result)
}
```

On **Starter (0.5 vCPU)**, goroutines help mainly during I/O wait. On **Standard (1 vCPU)**, two client rebuilds can genuinely run in parallel.

---

## 5. Migration Path

Do **not** big-bang rewrite. Use a strangler pattern.

### Phase 0 — Prerequisites (stay on Node)

1. Raise heap cap (256 → 384 MB)
2. Increase cache TTLs
3. Reduce polling interval / visibility-aware polling
4. Add Redis (Upstash free tier)

**Gain:** 2–3× capacity. **Effort:** 1–2 days.

### Phase 1 — Go skeleton (1 week)

- `main.go` + health check + `checkCompany` + `login`
- Deploy alongside Node on a second Render service (staging URL)
- Frontend points to Go staging via env var for testing

### Phase 2 — Port read endpoints (2–3 weeks)

- `dashboard`, `poDetails`, `supplierPerformance`, `supplierDetail`
- Port classifier logic with **unit tests** comparing Go output vs Node output for same sheet data
- Shared Redis cache (both Node and Go can read during transition)

### Phase 3 — Cutover (1 day)

- Point `VITE_APPS_SCRIPT_URL` to Go service
- Keep Node service running 1 week as fallback
- Decommission Node

### Phase 4 — Go-specific optimizations (ongoing)

- Struct-based sheet parsing instead of `map[string]interface{}`
- `sync.Pool` for row buffers
- Parallel client rebuilds on Standard plan
- Precomputed per-client views

**Total estimated effort:** 3–5 weeks for one developer familiar with Go.

---

## 6. Render Deployment for Go

### Dockerfile

```dockerfile
# Build stage
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Run stage
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 10000
CMD ["./server"]
```

### Render settings

| Setting | Value |
|---|---|
| Build | Docker or `go build -o server ./cmd/server` |
| Start | `./server` |
| Plan | Starter for dev; **Standard for production** if using Go's concurrency |
| Env vars | Same as current Node backend |

### Memory comparison

| | Node (Starter) | Go (Starter) |
|---|---|---|
| Process baseline | ~60 MB | ~15–25 MB |
| Raw sheet cache | 80–150 MB | 50–100 MB |
| Heap cap issue | Yes (256 MB) | No |
| Headroom for spikes | Low | Moderate |

---

## 7. Other Optimization Options (Ranked by ROI)

Better options to consider **before or alongside** a Go rewrite.

### Tier A — Highest ROI (do these first)

| # | Option | Effort | Capacity gain | Fixes root cause? |
|---|---|---|---|---|
| A1 | **Per-client slim sheet views** (n8n maintains `Comm Logs - C0`, `Comm Logs - C1`) | Medium | **5–10×** | ✅ Yes |
| A2 | **Redis cache** (Upstash) | Low | **2–3×** | ✅ Survives deploys |
| A3 | **Reduce polling** (60s + visibility check) | Low | **2×** | ✅ Fewer requests |
| A4 | **Raise heap cap + longer TTL** | Very low | **1.5–2×** | Partial |
| A5 | **Render Standard upgrade** (2 GB / 1 CPU) | Low ($) | **2–3×** | ✅ More headroom |

### Tier B — Strong architecture improvements

| # | Option | Effort | Capacity gain | Notes |
|---|---|---|---|---|
| B1 | **Sheets → Postgres sync** (n8n or cron every 2–5 min) | High | **10–50×** | Best long-term fix |
| B2 | **Paginated dashboard API** | Medium | **3–5×** | Fast first paint |
| B3 | **WebSocket / SSE push** (replace polling) | High | **5–10×** | Only update when data changes |
| B4 | **Narrow column ranges** (`A1:AZ` not `A1:IZ`) | Low | **1.3–1.5×** | Less data per fetch |
| B5 | **Pre-aggregated summary sheet** | Medium | **3×** for KPIs | n8n writes counts per client |

### Tier C — Runtime alternatives (compare to Go)

| # | Option | vs Go | Notes |
|---|---|---|---|
| C1 | **Stay Node + worker_threads** for sheet parsing | 60% of Go benefit | No rewrite; add parallelism in `sheets.service.js` |
| C2 | **Bun runtime** (drop-in Node replacement) | 30–50% faster Node | Zero rewrite; still single-threaded for CPU |
| C3 | **Go rewrite** | Baseline | Best runtime option for concurrent I/O + memory |
| C4 | **Rust (Axum/Actix)** | Slightly faster than Go | Much higher dev cost; overkill for this app |
| C5 | **Serverless (Lambda/Cloud Functions)** | Worse for this workload | Cold starts + 9k row processing = bad fit |

### Tier D — Frontend / edge optimizations

| # | Option | Effort | Gain |
|---|---|---|---|
| D1 | `sessionStorage` cache + stale-while-revalidate | Low | Perceived speed |
| D2 | Manual refresh button, no auto-poll | Low | Cuts requests 90%+ |
| D3 | CDN edge cache for semi-static per-client summaries | Medium | Requires cacheable GET + short TTL |

---

## 8. Decision Matrix

| Your situation | Recommended path |
|---|---|
| ≤8 users, 1–2 clients, pilot phase | **Stay Node** + Tier A quick wins |
| 8–15 users, occasional slowdowns | **Tier A + Render Standard** — no rewrite needed |
| 15–30 users, 3–5 clients | **Postgres sync (B1) + Redis** — bigger win than Go |
| 30+ users, multi-tenant | **B1 + B3** (DB + push) — architectural change required |
| Team knows Go, wants cleaner ops | **Go rewrite after Tier A** — justified as Phase 2 |
| Team only knows JavaScript | **Node + worker_threads + Tier A** — avoid Go rewrite cost |

### Go vs Stay Node vs Postgres — side by side

| Criteria | Stay Node + fixes | Go rewrite | Postgres sync |
|---|---|---|---|
| Dev effort | 1–3 days | 3–5 weeks | 2–4 weeks |
| Capacity gain | 2–4× | 2–3× (runtime only) | 10–50× |
| Fixes full-sheet load | Only with A1 views | Only with A1 views | ✅ Native SQL filter |
| Survives deploy | With Redis | With Redis | ✅ Always |
| Risk | Low | Medium | Medium |
| Monthly cost | +$0–18 (Redis/Standard) | +$0–18 | +$15–50 (DB) |

---

## 9. Recommended Strategy

```
Step 1 (this week, Node)     → heap cap, TTL, polling, protect cache flush
Step 2 (next week, Node)     → Upstash Redis
Step 3 (week 3, n8n)         → per-client slim comm-log view sheets
Step 4 (month 2)             → Render Standard ($25/mo)
Step 5 (evaluate)            → If still bottlenecked: Postgres sync OR Go rewrite
Step 6 (only if needed)      → Go rewrite for runtime efficiency on top of fixed architecture
```

**Do not skip Steps 1–4 and jump straight to Go.** A Go rewrite of the current full-sheet-read architecture on Starter will still struggle at ~12–15 concurrent users.

**The ideal combo:** Fix data access (A1/B1) + Redis (A2) + Go runtime = comfortably serves **30–50 concurrent users** on Standard.

---

## 10. Go Rewrite — Risks & Gotchas

| Risk | Mitigation |
|---|---|
| Business logic drift (classifier bugs) | Golden-file tests: same input rows → same JSON as Node |
| JWT format mismatch | Use same `JWT_SECRET`, same claims (`clientCode`, `email`, etc.) |
| bcrypt hash compatibility | Go `bcrypt.CompareHashAndPassword` reads Node `$2b$` hashes |
| SHA-256 legacy passwords | Port `hashPasswordSha256` fallback from `auth.service.js` |
| Google Sheets API quirks | Port `resolveSheetName()` logic for tab name variants |
| Render 0.5 vCPU still limits Go | Upgrade to Standard to unlock Go's concurrency |
| Two backends during migration | Shared Redis prevents double Sheets API calls |

---

## 11. Porting Checklist

| Node file | Go package | Priority |
|---|---|---|
| `server.js` (action router) | `handlers/router.go` | P0 |
| `auth.service.js` | `services/auth.go` | P0 |
| `auth.js` middleware | `middleware/auth.go` | P0 |
| `clientFilter.js` | `middleware/clientfilter.go` | P0 |
| `sheets.service.js` | `services/sheets.go` | P0 |
| `cache.service.js` | `services/cache.go` | P0 |
| `dashboard.controller.js` | `handlers/dashboard.go` + `services/classifier.go` | P0 |
| `po.controller.js` | `handlers/po.go` | P1 |
| `supplier.controller.js` | `handlers/supplier.go` | P1 |
| Mock data fallback | `services/mock.go` | P2 (dev only) |

---

## 12. Summary

| Approach | When to use | Expected outcome |
|---|---|---|
| **Node + quick fixes** | Now, always first | 5–8 → 10–12 users on Starter |
| **Node + Redis + slim sheets** | Before any rewrite | 15–20 users on Starter |
| **Render Standard + above** | Team rollout | 20–30 users |
| **Postgres sync** | Multi-client production | 50–100+ users |
| **Go rewrite alone** | Rarely the right first step | +30–50% on same architecture |
| **Go + fixed architecture** | Mature product, Go team | 30–50 users on Standard |
| **WebSocket push + DB** | Enterprise scale | 100+ users |

### What Go helps with

- Memory efficiency
- Concurrent I/O
- Faster parsing
- No heap cap
- Cleaner deploy artifact

### What Go does not help with (without other changes)

- Full-sheet reads
- Polling frequency
- Cache lost on deploy
- Sheets API quota
- Multi-tenant data isolation

**Best optimization is not a language — it's querying less data, caching it externally, and polling less often.**

---

## Appendix — Optimization priority cheat sheet

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OPTIMIZATION PRIORITY (HIGHEST ROI FIRST)              │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Per-client slim sheet views (n8n)         → 5–10×   [architecture]  │
│  2. Redis cache (Upstash)                     → 2–3×    [infra]         │
│  3. Reduce / smart polling (frontend)         → 2×      [frontend]      │
│  4. Render Standard (2GB / 1 CPU)              → 2–3×    [infra]         │
│  5. Postgres read replica                     → 10–50×   [architecture]  │
│  6. Node quick fixes (heap, TTL)               → 1.5–2×  [config]        │
│  7. Go rewrite (after 1–5)                    → 2–3×    [runtime]       │
│  8. WebSocket push                            → 5–10×   [architecture]  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

*Planning document only. Pairs with `dashboard_capacity_and_deployment_guide.md` for full system capacity analysis.*
# Historical Go migration notes

> This is an older alternative-backend proposal and references the retired query-string API. It is not the current implementation or deployment runbook.
