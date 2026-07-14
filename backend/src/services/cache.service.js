const NodeCache = require('node-cache');

// Default TTL of 60 seconds (1 minute), checkperiod of 120 seconds
const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  // Cached values are treated as immutable. Avoid cloning multi-megabyte sheet
  // arrays and API responses on every cache access.
  useClones: false,
});

const pendingBuilds = new Map();
let generation = 0;

const cacheService = {
  get: (key) => {
    return cache.get(key);
  },

  set: (key, value, ttl) => {
    if (ttl) {
      return cache.set(key, value, ttl);
    }
    return cache.set(key, value);
  },

  del: (key) => {
    return cache.del(key);
  },

  flush: () => {
    generation += 1;
    pendingBuilds.clear();
    return cache.flushAll();
  },

  getOrSet: async (key, ttl, producer) => {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    if (pendingBuilds.has(key)) return pendingBuilds.get(key);

    const buildGeneration = generation;
    const pending = Promise.resolve()
      .then(producer)
      .then(value => {
        // A cache flush that happened while the producer was running wins.
        if (buildGeneration === generation) cache.set(key, value, ttl);
        return value;
      })
      .finally(() => {
        if (pendingBuilds.get(key) === pending) pendingBuilds.delete(key);
      });

    pendingBuilds.set(key, pending);
    return pending;
  },

  getStats: () => cache.getStats(),

  // Generate cache keys based on client code and endpoint
  generateKey: (prefix, clientCode, extra = '') => {
    return `${prefix}:${clientCode || 'global'}:${extra}`;
  }
};

module.exports = cacheService;
