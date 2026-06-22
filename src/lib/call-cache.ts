// Tiny in-memory TTL cache. The same Vercel function instance handles many
// turns of one call; refetching all business + agent data from Neon on every
// turn adds ~250ms per turn. This cache holds the data for the lifetime of a
// call (10 min default), keyed by callSessionId.
//
// Single-instance only — Vercel may scale to multiple instances, but each one
// will warm independently. Worst case: cache miss = same latency as before.

type Entry<V> = { value: V; expiresAt: number };
const store = new Map<string, Entry<unknown>>();

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function callCacheGet<V>(key: string): V | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value as V;
}

export function callCacheSet<V>(key: string, value: V, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Convenience: get-or-load. Concurrent calls for the same key share one fetch.
const inflight = new Map<string, Promise<unknown>>();

export async function callCacheGetOrLoad<V>(
  key: string,
  loader: () => Promise<V>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<V> {
  const hit = callCacheGet<V>(key);
  if (hit !== null) return hit;

  let pending = inflight.get(key) as Promise<V> | undefined;
  if (!pending) {
    pending = loader().then(value => {
      callCacheSet(key, value, ttlMs);
      inflight.delete(key);
      return value;
    }, err => {
      inflight.delete(key);
      throw err;
    });
    inflight.set(key, pending);
  }
  return pending;
}
