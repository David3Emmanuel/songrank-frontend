/**
 * A small in-memory cache with a time to live.
 *
 * Used for search results, where the same query arrives twice as soon as someone
 * types ahead of themselves, and the upstream call costs the best part of a
 * second.
 */

export interface TtlCache<V> {
  get(key: string): V | undefined
  set(key: string, value: V): void
  size(): number
}

export interface TtlCacheOptions {
  ttlMs: number
  /** Oldest entries are dropped past this, so an odd query cannot grow it. */
  maxEntries?: number
  /** Injectable so the expiry can be tested without waiting. */
  now?: () => number
}

export function createTtlCache<V>({
  ttlMs,
  maxEntries = 100,
  now = Date.now,
}: TtlCacheOptions): TtlCache<V> {
  const entries = new Map<string, { value: V; expiresAt: number }>()

  const dropExpired = (at: number) => {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= at) entries.delete(key)
    }
  }

  return {
    get(key) {
      const at = now()
      const entry = entries.get(key)
      if (!entry) return undefined
      if (entry.expiresAt <= at) {
        entries.delete(key)
        return undefined
      }
      return entry.value
    },

    set(key, value) {
      const at = now()
      dropExpired(at)
      entries.set(key, { value, expiresAt: at + ttlMs })

      // Map keeps insertion order, so the first key is the oldest.
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value
        if (oldest === undefined) break
        entries.delete(oldest)
      }
    },

    size() {
      dropExpired(now())
      return entries.size
    },
  }
}

/** Case and spacing should not decide whether a query is a repeat. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}
