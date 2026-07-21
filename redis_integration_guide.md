# Redis Integration Guide for Akisto Dashboard

## Overview

The Akisto backend currently uses **`node-cache`** — an in-process, in-memory cache that lives inside the Node.js process. While this works for a single server instance, it has real limitations. Redis is a dedicated external caching server that will unlock significant performance and reliability improvements.

---

## Why Switch from `node-cache` to Redis?

| Feature | `node-cache` (current) | Redis (proposed) |
|---|---|---|
| **Storage** | Inside Node.js process heap | Separate server process |
| **Survives server restart** | ❌ No — cache is wiped on every deploy | ✅ Yes — data persists |
| **Multi-instance sharing** | ❌ No — each instance has its own cache | ✅ Yes — all instances share one cache |
| **Memory limit** | Competes with app for RAM (256MB limit set!) | Dedicated memory, no competition |
| **Max data size** | Bounded by `--max-old-space-size=256` | Configurable separately (can be GBs) |
| **Pub/Sub (realtime invalidation)** | ❌ Not available | ✅ Built-in |
| **Cache inspection/debugging** | ❌ Black box | ✅ `redis-cli`, RedisInsight GUI |
| **TTL precision** | Seconds | Milliseconds |

---

## What Will Redis Specifically Optimize in This Project?

### 1. Google Sheets API Quota Protection ⭐ Highest Impact

**Current problem:** Every non-cached request hits the Google Sheets API. The API has a limit of **~60 reads per minute per project**. Under load (multiple users, multiple dashboard tabs), this cap is easily hit.

**With Redis:** Raw sheet data (`raw_sheet:PO consolidated data`, etc.) is cached in Redis with a 2-minute TTL. All Node.js instances share this cache, so even if you scale to 3 server replicas, there's only **1 API call per 2 minutes per sheet** instead of N calls per instance.

Relevant code in [sheets.service.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/services/sheets.service.js#L400-L415):
```js
// Currently: node-cache.get() — per-process only
const cachedData = cacheService.get(cacheKey);
```

### 2. Dashboard Response Time (60s Cache)

**Current problem:** The dashboard endpoint re-processes hundreds of PO rows + comm log rows every 60 seconds per client. With `node-cache`, this processed result is in-memory but reset on every redeploy.

**With Redis:** The processed `dashboard:C1:` result survives deploys, meaning the **first user after a deploy** still gets a fast cached response instead of a cold ~2-3 second API round-trip.

Relevant code in [dashboard.controller.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/controllers/dashboard.controller.js#L238-L329).

### 3. Session / JWT Blacklisting (New Capability)

**Current problem:** There is no way to invalidate a JWT token before it expires (e.g., on logout or password change). With `node-cache`, a blocklist can't be shared across server restarts.

**With Redis:** Store invalidated token IDs with a TTL matching the JWT expiry. Any server instance checks Redis on every request, enabling true logout.

### 4. Rate Limiting Across Instances

**Current problem:** `express-rate-limit` in [server.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/server.js#L60-L70) uses in-memory storage. If you run 2 replicas, each allows 100 req/15min independently — so a user actually gets 200 requests.

**With Redis:** Use `rate-limit-redis` store so limits are shared across all instances accurately.

### 5. Spreadsheet Metadata Cache (1h TTL)

The sheet title list (`spreadsheet_sheets_list:<id>`) is cached for 1 hour. With Redis, this 1-hour cache survives server restarts, saving the expensive `spreadsheets.get()` metadata call on cold starts.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────┐
│                  Vercel / Cloud                  │
│                                                  │
│  ┌─────────────┐    ┌─────────────┐              │
│  │  Node.js    │    │  Node.js    │   (scaled)   │
│  │  Instance 1 │    │  Instance 2 │              │
│  └──────┬──────┘    └──────┬──────┘              │
│         │                  │                     │
│         └─────────┬────────┘                     │
│                   │  All share one cache         │
│           ┌───────▼────────┐                     │
│           │  Redis Server  │  ← Upstash / Render │
│           │  (Persistent)  │                     │
│           └───────┬────────┘                     │
│                   │ only on cache miss           │
│           ┌───────▼────────┐                     │
│           │  Google Sheets │                     │
│           │  API           │                     │
│           └────────────────┘                     │
└──────────────────────────────────────────────────┘
```

---

## Step-by-Step Implementation

### Step 1: Choose a Redis Provider

**For local development:**
- [Install Redis on Windows via WSL](https://redis.io/docs/install/install-redis/install-redis-on-windows/) or use Docker:
  ```bash
  docker run -d -p 6379:6379 redis:alpine
  ```

**For production (free tier available):**
- **Upstash** (recommended — serverless, works on Vercel): https://upstash.com
- **Redis Cloud**: https://redis.com/try-free/
- **Render**: Add a Redis service alongside your backend

---

### Step 2: Install Dependencies

```bash
cd backend
npm install ioredis
# Optional: for Redis-backed rate limiting
npm install rate-limit-redis
```

> **Why `ioredis`?** It supports Upstash, connection pooling, automatic reconnect, and cluster mode — more robust than the older `redis` package.

---

### Step 3: Create Redis Config File

Create a new file: **`backend/src/config/redis.js`**

```js
// backend/src/config/redis.js
const Redis = require('ioredis');

let redisClient = null;
let isRedisAvailable = false;

const createRedisClient = () => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not set. Redis caching disabled — falling back to node-cache.');
    return null;
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false, // Don't queue commands when disconnected
    connectTimeout: 5000,
  });

  client.on('connect', () => {
    isRedisAvailable = true;
    console.log('[Redis] Connected successfully.');
  });

  client.on('error', (err) => {
    if (isRedisAvailable) {
      console.error('[Redis] Connection error:', err.message);
    }
    isRedisAvailable = false;
  });

  client.on('close', () => {
    isRedisAvailable = false;
  });

  return client;
};

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

const isAvailable = () => isRedisAvailable;

module.exports = { getRedisClient, isAvailable };
```

---

### Step 4: Rewrite `cache.service.js` with Redis + Fallback

Replace the current [cache.service.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/services/cache.service.js) with a **dual-layer** implementation: Redis first, `node-cache` as fallback.

```js
// backend/src/services/cache.service.js
const NodeCache = require('node-cache');
const { getRedisClient, isAvailable } = require('../config/redis');

// Fallback: in-memory node-cache (still used if Redis is unavailable)
const localCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

const CACHE_PREFIX = 'akisto:';

const cacheService = {
  /**
   * Get a value from cache. Redis first, then node-cache.
   */
  get: async (key) => {
    const prefixedKey = CACHE_PREFIX + key;

    // 1. Try Redis
    if (isAvailable()) {
      try {
        const client = getRedisClient();
        const value = await client.get(prefixedKey);
        if (value !== null) {
          return JSON.parse(value);
        }
      } catch (err) {
        console.warn(`[Cache] Redis GET failed for "${key}":`, err.message);
      }
    }

    // 2. Fallback to node-cache (synchronous)
    return localCache.get(key) ?? null;
  },

  /**
   * Set a value in cache. Writes to both Redis and node-cache.
   * @param {string} key
   * @param {*} value
   * @param {number} ttl - seconds
   */
  set: async (key, value, ttl = 60) => {
    const prefixedKey = CACHE_PREFIX + key;
    const serialized = JSON.stringify(value);

    // 1. Write to Redis
    if (isAvailable()) {
      try {
        const client = getRedisClient();
        await client.set(prefixedKey, serialized, 'EX', ttl);
      } catch (err) {
        console.warn(`[Cache] Redis SET failed for "${key}":`, err.message);
      }
    }

    // 2. Also write to node-cache as local fallback
    localCache.set(key, value, ttl);
  },

  /**
   * Delete a key from both caches.
   */
  del: async (key) => {
    const prefixedKey = CACHE_PREFIX + key;

    if (isAvailable()) {
      try {
        const client = getRedisClient();
        await client.del(prefixedKey);
      } catch (err) {
        console.warn(`[Cache] Redis DEL failed for "${key}":`, err.message);
      }
    }

    localCache.del(key);
  },

  /**
   * Flush all Akisto cache keys from Redis (uses SCAN, not FLUSHALL).
   * Safe to use in production — only deletes keys with our prefix.
   */
  flush: async () => {
    if (isAvailable()) {
      try {
        const client = getRedisClient();
        let cursor = '0';
        do {
          const [nextCursor, keys] = await client.scan(
            cursor, 'MATCH', `${CACHE_PREFIX}*`, 'COUNT', 100
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await client.del(...keys);
            console.log(`[Cache] Flushed ${keys.length} Redis keys.`);
          }
        } while (cursor !== '0');
      } catch (err) {
        console.warn('[Cache] Redis FLUSH failed:', err.message);
      }
    }

    localCache.flushAll();
  },

  /**
   * Generate a namespaced cache key.
   */
  generateKey: (prefix, clientCode, extra = '') => {
    return `${prefix}:${clientCode || 'global'}:${extra}`;
  }
};

module.exports = cacheService;
```

> [!IMPORTANT]
> The `cache.service.js` methods are now **async**. You must add `await` to all `cacheService.get()`, `cacheService.set()`, `cacheService.del()` and `cacheService.flush()` calls in controllers and services.

---

### Step 5: Update Controllers to Use `await`

Because `cacheService.get/set` are now async, update each controller.

#### `dashboard.controller.js` — Key changes:

```js
// Before:
const cachedData = cacheService.get(cacheKey);
// ...
cacheService.set(cacheKey, output, 60);

// After:
const cachedData = await cacheService.get(cacheKey);
// ...
await cacheService.set(cacheKey, output, 60);
```

Apply the same pattern to:
- [po.controller.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/controllers/po.controller.js)
- [supplier.controller.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/controllers/supplier.controller.js)

#### `sheets.service.js` — Key changes:

```js
// Before (line ~406):
const cachedData = cacheService.get(cacheKey);
if (cachedData) { ... }

// After:
const cachedData = await cacheService.get(cacheKey);
if (cachedData) { ... }

// Before (line ~439):
cacheService.set(cacheKey, rows, 300);

// After:
await cacheService.set(cacheKey, rows, 300);
```

---

### Step 6: Initialize Redis in `server.js`

Add Redis initialization at the top of [server.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/server.js):

```js
// At the top, after dotenv.config():
const { getRedisClient } = require('./config/redis');

// Initialize Redis connection early
getRedisClient(); // Establishes the connection in the background
```

And update the cache flush endpoint to be async:
```js
// Cache Flush Endpoint (updated)
app.post('/api/cache/flush', async (req, res) => {
  const cacheService = require('./services/cache.service');
  await cacheService.flush();
  console.log('[Cache Flush] Cache flushed successfully.');
  return res.json({ success: true, message: 'Cache flushed successfully' });
});
```

---

### Step 7: (Optional) Redis-backed Rate Limiting

Replace the in-memory rate limiter in `server.js`:

```bash
npm install rate-limit-redis
```

```js
// server.js
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('./config/redis');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store if available, otherwise falls back to memory
  store: process.env.REDIS_URL
    ? new RedisStore({
        sendCommand: (...args) => getRedisClient().call(...args),
      })
    : undefined,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});
```

---

### Step 8: Add Environment Variable

Add to **`backend/.env`**:
```env
# Redis connection URL
# Local:  redis://localhost:6379
# Upstash: rediss://default:<password>@<host>.upstash.io:6379
REDIS_URL=redis://localhost:6379
```

Add to **`backend/.env`** (for production on Vercel/Render, set this in the dashboard's environment variables UI).

---

## Cache TTL Strategy (Recommended Values)

| Cache Key Pattern | Data | TTL | Rationale |
|---|---|---|---|
| `akisto:raw_sheet:PO consolidated data` | Raw Google Sheets rows | **120s** | Balance freshness vs. API quota |
| `akisto:raw_sheet:Communication Logs` | Raw comm logs | **120s** | Same as above |
| `akisto:raw_sheet:Users` | User list | **300s** | Users rarely change |
| `akisto:raw_sheet:Client info` | Client config | **600s** | Config is very stable |
| `akisto:spreadsheet_sheets_list:*` | Sheet names list | **3600s** | Sheets structure rarely changes |
| `akisto:dashboard:C1:` | Processed dashboard data | **60s** | Fresh enough for real-time feel |
| `akisto:supplier:C1:` | Supplier list | **120s** | Moderate freshness |
| `akisto:po:C1:*` | PO detail | **60s** | User expects near-real-time |

---

## Testing the Integration

### 1. Verify Redis Connection
```bash
# In your terminal after starting the backend
redis-cli ping
# Should return: PONG
```

### 2. Inspect Cached Keys
```bash
redis-cli
> KEYS akisto:*
> TTL akisto:raw_sheet:PO consolidated data
> GET akisto:dashboard:C1:
```

### 3. Test Cache Flush Endpoint
```bash
curl -X POST http://localhost:5000/api/cache/flush
# Expected: { "success": true, "message": "Cache flushed successfully" }
```

### 4. Verify Fallback Works
- Stop your Redis server
- Make API requests — should still work using `node-cache`
- Restart Redis — should reconnect automatically

---

## Free Redis Hosting Options

### Upstash (Best for Vercel)
1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database → choose the same region as your backend
3. Copy the **REST URL** or **Redis URL** (use the `rediss://` TLS version)
4. Paste into `REDIS_URL` env var

**Free tier:** 10,000 commands/day, 256MB storage — sufficient for this project.

### Render
1. In your Render dashboard → New → Redis
2. Free tier: 25MB (enough for caching use cases here)
3. Use the **Internal Redis URL** for your backend service

---

## Summary of Files to Modify

| File | Change |
|---|---|
| [backend/package.json](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/package.json) | Add `ioredis`, optionally `rate-limit-redis` |
| [backend/.env](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/.env) | Add `REDIS_URL` |
| **[NEW]** `backend/src/config/redis.js` | Redis client factory with graceful fallback |
| [backend/src/services/cache.service.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/services/cache.service.js) | Rewrite with async Redis + node-cache fallback |
| [backend/src/services/sheets.service.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/services/sheets.service.js) | Add `await` to all `cacheService.get/set` calls |
| [backend/src/controllers/dashboard.controller.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/controllers/dashboard.controller.js) | Add `await` to all `cacheService.get/set` calls |
| [backend/src/controllers/po.controller.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/controllers/po.controller.js) | Add `await` to all `cacheService.get/set` calls |
| [backend/src/controllers/supplier.controller.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/controllers/supplier.controller.js) | Add `await` to all `cacheService.get/set` calls |
| [backend/src/server.js](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/backend/src/server.js) | Initialize Redis on startup, make flush endpoint async |

---

> [!TIP]
> The design uses a **graceful fallback pattern** — if Redis is not configured (`REDIS_URL` not set) or goes down, the app automatically falls back to `node-cache`. This means zero risk: you can deploy to production and toggle Redis on via a single environment variable.
