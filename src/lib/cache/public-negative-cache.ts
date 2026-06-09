/**
 * In-process negative cache for hot public API miss paths (invalid / unknown short codes).
 * Reduces DB + Redis pressure under burst traffic (load tests, scanners, typos).
 */

const DEFAULT_TTL_MS = Number.parseInt(process.env.PUBLIC_NEGATIVE_CACHE_TTL_MS || '30000', 10);
const MAX_ENTRIES = Number.parseInt(process.env.PUBLIC_NEGATIVE_CACHE_MAX_ENTRIES || '5000', 10);

type Entry = { expiresAt: number };

const missingShortCodes = new Map<string, Entry>();

function pruneIfNeeded(): void {
  if (missingShortCodes.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of missingShortCodes) {
    if (entry.expiresAt <= now) missingShortCodes.delete(key);
    if (missingShortCodes.size <= MAX_ENTRIES * 0.8) break;
  }
  if (missingShortCodes.size > MAX_ENTRIES) {
    const overflow = missingShortCodes.size - MAX_ENTRIES;
    const keys = Array.from(missingShortCodes.keys()).slice(0, overflow);
    for (const key of keys) missingShortCodes.delete(key);
  }
}

export function isPublicShortCodeNegativelyCached(shortCode: string): boolean {
  const entry = missingShortCodes.get(shortCode);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    missingShortCodes.delete(shortCode);
    return false;
  }
  return true;
}

export function cachePublicShortCodeMiss(shortCode: string, ttlMs = DEFAULT_TTL_MS): void {
  missingShortCodes.set(shortCode, { expiresAt: Date.now() + ttlMs });
  pruneIfNeeded();
}
