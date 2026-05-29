// In-memory cache for instant folder switching (avoids async IDB read latency).
// Keyed by "account:folder:page", stores processed messages ready for display.
//
// Backed by a bounded LRU so the cache cannot grow without limit as the user
// browses folders/pages and switches accounts over a long session. The
// most-recently-used entries (the pages actually being viewed) are retained;
// the oldest are evicted once the cap is reached.

// Maximum number of cached "account:folder:page" entries to retain.
export const MAX_FOLDER_MESSAGE_CACHE = 50;

/**
 * A Map-compatible cache with a fixed capacity and least-recently-used eviction.
 * Recency is refreshed on both `get` and `set`; once `size` would exceed the
 * cap, the oldest entries are evicted. Drop-in for the subset of the Map API the
 * message-list cache uses (`get`/`set`/`has`/`delete`/`clear`/`keys`/`size`).
 *
 * Generic on purpose — liftable to src/utils if other ad-hoc caches want it.
 */
export class BoundedLruMap<K, V> {
  #max: number;
  #map = new Map<K, V>();

  constructor(max: number) {
    // Guard against 0/NaN/negative caps so the cache always holds >= 1 entry.
    this.#max = Math.max(1, Math.floor(max) || 1);
  }

  get size(): number {
    return this.#map.size;
  }

  has(key: K): boolean {
    return this.#map.has(key);
  }

  get(key: K): V | undefined {
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key) as V;
    // Promote to most-recently-used so the page in view survives eviction.
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  set(key: K, value: V): this {
    // Re-insert so an existing key moves to the most-recently-used position.
    if (this.#map.has(key)) this.#map.delete(key);
    this.#map.set(key, value);
    // Map preserves insertion order, so the first key is always the oldest.
    while (this.#map.size > this.#max) {
      const oldest = this.#map.keys().next().value as K;
      this.#map.delete(oldest);
    }
    return this;
  }

  delete(key: K): boolean {
    return this.#map.delete(key);
  }

  clear(): void {
    this.#map.clear();
  }

  keys(): IterableIterator<K> {
    return this.#map.keys();
  }
}

export const folderMessageCache = new BoundedLruMap<string, unknown>(MAX_FOLDER_MESSAGE_CACHE);
