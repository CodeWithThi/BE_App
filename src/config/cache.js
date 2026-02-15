/**
 * Simple In-Memory Cache with TTL
 * Use for data that changes infrequently: departments, members, labels
 * No Redis dependency — works out of the box
 */
class MemoryCache {
    constructor() {
        this.store = new Map();
        // Clean up expired entries every 60 seconds
        this._cleanup = setInterval(() => this.purgeExpired(), 60 * 1000);
    }

    /**
     * Get cached value or fetch from source
     * @param {string} key - Cache key
     * @param {number} ttlSeconds - Time to live in seconds
     * @param {Function} fetchFn - Async function to fetch data if cache miss
     */
    async getOrSet(key, ttlSeconds, fetchFn) {
        const cached = this.store.get(key);
        if (cached && cached.expiry > Date.now()) {
            return cached.value;
        }

        // Cache miss — fetch fresh data
        const value = await fetchFn();
        this.store.set(key, {
            value,
            expiry: Date.now() + (ttlSeconds * 1000)
        });
        return value;
    }

    /**
     * Invalidate specific key or pattern
     * @param {string} pattern - Exact key or prefix with '*' wildcard
     */
    invalidate(pattern) {
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            for (const key of this.store.keys()) {
                if (key.startsWith(prefix)) {
                    this.store.delete(key);
                }
            }
        } else {
            this.store.delete(pattern);
        }
    }

    /** Remove all expired entries */
    purgeExpired() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (entry.expiry <= now) {
                this.store.delete(key);
            }
        }
    }

    /** Get cache stats for monitoring */
    stats() {
        let active = 0;
        let expired = 0;
        const now = Date.now();
        for (const entry of this.store.values()) {
            if (entry.expiry > now) active++;
            else expired++;
        }
        return { active, expired, total: this.store.size };
    }

    /** Clean shutdown */
    destroy() {
        clearInterval(this._cleanup);
        this.store.clear();
    }
}

// Singleton instance
const cache = new MemoryCache();
export default cache;
