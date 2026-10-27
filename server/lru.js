// server/lru.js
// Cost-bounded LRU cache and in-flight request deduplication for candle data.
// Total budget: 300,000 bars shared across response cache, last-good and minute-day caches (FR-010).

export class CostLruCache {
  /**
   * @param {number} maxCost Maximum cumulative cost (default 300,000 bars)
   */
  constructor(maxCost = 300000) {
    this.maxCost = maxCost;
    this.totalCost = 0;
    this.map = new Map();
  }

  /**
   * Retrieves an item if present and not expired, updating LRU order.
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }

    // Refresh LRU order: delete and re-insert
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /**
   * Checks if key exists and is not expired.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Sets an entry with associated cost and optional TTL in ms.
   * Evicts least-recently-used items when totalCost exceeds maxCost.
   *
   * @param {string} key
   * @param {any} value
   * @param {number} cost
   * @param {number|null} ttlMs
   */
  set(key, value, cost = 1, ttlMs = null) {
    const numericCost = Math.max(1, Number(cost) || 1);

    if (this.map.has(key)) {
      const existing = this.map.get(key);
      this.totalCost -= existing.cost;
      this.map.delete(key);
    }

    const entry = {
      value,
      cost: numericCost,
      expiresAt: (ttlMs !== null && ttlMs !== undefined) ? Date.now() + ttlMs : null
    };

    this.map.set(key, entry);
    this.totalCost += numericCost;

    // Evict oldest entries until within budget
    while (this.totalCost > this.maxCost && this.map.size > 0) {
      const oldestKey = this.map.keys().next().value;
      const oldestEntry = this.map.get(oldestKey);
      this.totalCost -= oldestEntry.cost;
      this.map.delete(oldestKey);
    }
  }

  /**
   * Removes an entry by key and updates totalCost.
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    const entry = this.map.get(key);
    if (entry) {
      this.totalCost -= entry.cost;
      this.map.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clears all entries and resets totalCost.
   */
  clear() {
    this.map.clear();
    this.totalCost = 0;
  }

  get size() {
    return this.map.size;
  }

  get cost() {
    return this.totalCost;
  }
}

// Shared cost-bounded LRU instance for candles (300,000 bars max)
export const candleLru = new CostLruCache(300000);

// In-flight deduplication map
const inFlightMap = new Map();

/**
 * Deduplicates identical concurrent asynchronous operations by key.
 *
 * @param {string} key
 * @param {() => Promise<any>} asyncFn
 * @returns {Promise<any>}
 */
export async function dedupeInFlight(key, asyncFn) {
  if (inFlightMap.has(key)) {
    return inFlightMap.get(key);
  }

  const promise = (async () => {
    try {
      return await asyncFn();
    } finally {
      inFlightMap.delete(key);
    }
  })();

  inFlightMap.set(key, promise);
  return promise;
}
