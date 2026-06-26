const NodeCache = require('node-cache');

// Default TTL of 60 seconds (1 minute), checkperiod of 120 seconds
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

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
    return cache.flushAll();
  },

  // Generate cache keys based on client code and endpoint
  generateKey: (prefix, clientCode, extra = '') => {
    return `${prefix}:${clientCode || 'global'}:${extra}`;
  }
};

module.exports = cacheService;
