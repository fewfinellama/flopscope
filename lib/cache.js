/**
 * In-Memory TTL & LRU Cache for Technocore API responses.
 * Provides micro-caching, LRU eviction, and periodic background sweeping
 * to prevent upstream rate limit exhaustion and memory leaks.
 */
class MemoryCache {
  constructor(defaultTtlMs = 60000, maxEntries = 2000) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;

    // Periodic cleanup every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.purgeExpired();
    }, 60000);

    // Prevent interval from keeping the process alive in tests
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  set(key, data, ttlMs = this.defaultTtlMs) {
    // If key exists, delete it first so insertion updates position
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      // LRU Eviction: Remove the oldest inserted/accessed item
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    const expiresAt = Date.now() + ttlMs;
    const entry = {
      data,
      cachedAt: Date.now(),
      expiresAt,
      ttlMs,
    };
    this.store.set(key, entry);
    return entry;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    // Refresh LRU order on access
    this.store.delete(key);
    this.store.set(key, entry);

    this.hits++;
    return {
      data: entry.data,
      cachedAt: entry.cachedAt,
      ageMs: Date.now() - entry.cachedAt,
      expiresInMs: entry.expiresAt - Date.now(),
    };
  }

  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  purgeExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  stats() {
    this.purgeExpired();
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
    return {
      itemCount: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRatePercent: parseFloat(hitRate.toFixed(2)),
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = {
  MemoryCache,
};
