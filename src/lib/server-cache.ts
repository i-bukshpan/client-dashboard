/**
 * src/lib/server-cache.ts
 *
 * Lightweight in-memory TTL cache for server-side use.
 * Eliminates redundant Google API calls within the same request burst
 * (e.g., 8 dashboard widgets reading from the same spreadsheet).
 *
 * Features:
 *  - Per-key TTL with configurable default
 *  - LRU eviction when max entries exceeded
 *  - Invalidation by key or by prefix (e.g., all keys for a spreadsheet)
 *  - Thread-safe within a single Node.js process
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  lastAccessed: number
}

export class ServerCache<T = unknown> {
  private readonly store = new Map<string, CacheEntry<T>>()
  private readonly defaultTtlMs: number
  private readonly maxEntries: number

  constructor(options?: { defaultTtlMs?: number; maxEntries?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 60_000 // 60 seconds
    this.maxEntries = options?.maxEntries ?? 200
  }

  /** Retrieves a cached value. Returns `undefined` if expired or not found. */
  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    entry.lastAccessed = Date.now()
    return entry.value
  }

  /** Stores a value with an optional per-key TTL override (in ms). */
  set(key: string, value: T, ttlMs?: number): void {
    // Evict expired entries first
    if (this.store.size >= this.maxEntries) {
      this.evictExpired()
    }
    // If still at capacity, evict least-recently-accessed
    if (this.store.size >= this.maxEntries) {
      this.evictLRU()
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
      lastAccessed: Date.now(),
    })
  }

  /**
   * Gets a cached value or computes it if missing/expired.
   * Prevents thundering herd: concurrent calls for the same key
   * will await the same in-flight promise.
   */
  private inFlight = new Map<string, Promise<T>>()

  async getOrSet(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key)
    if (cached !== undefined) return cached

    const existing = this.inFlight.get(key)
    if (existing) return existing

    const promise = factory().then((value) => {
      this.set(key, value, ttlMs)
      this.inFlight.delete(key)
      return value
    }).catch((err) => {
      this.inFlight.delete(key)
      throw err
    })

    this.inFlight.set(key, promise)
    return promise
  }

  /** Invalidates a specific key. */
  invalidate(key: string): void {
    this.store.delete(key)
  }

  /** Invalidates all keys that start with the given prefix. */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key)
      }
    }
  }

  /** Clears the entire cache. */
  clear(): void {
    this.store.clear()
    this.inFlight.clear()
  }

  /** Current number of entries (including potentially expired ones). */
  get size(): number {
    return this.store.size
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private evictExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestAccess = Infinity
    for (const [key, entry] of this.store) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed
        oldestKey = key
      }
    }
    if (oldestKey) this.store.delete(oldestKey)
  }
}

// ── Shared singleton instances ────────────────────────────────────────────────

/** Cache for Google Sheets metadata (tab list, column counts). TTL: 60s. */
export const sheetsMetaCache = new ServerCache<any>({ defaultTtlMs: 60_000 })

/** Cache for Google Sheets row data. TTL: 30s. */
export const sheetsDataCache = new ServerCache<any>({ defaultTtlMs: 30_000 })

/** Cache for Gmail labels and metadata. TTL: 5 minutes. */
export const gmailCache = new ServerCache<any>({ defaultTtlMs: 300_000 })
