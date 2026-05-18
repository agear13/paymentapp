/**
 * Lightweight stale-while-revalidate cache for operator project workspace slices.
 * Not TanStack Query — scoped, minimal, and safe for incremental section hydration.
 */

export type WorkspaceCacheScope = 'summary' | 'participants' | 'full';

type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

function cacheKey(projectId: string, scope: WorkspaceCacheScope): string {
  return `workspace:${projectId}:${scope}`;
}

export function readWorkspaceCache<T>(projectId: string, scope: WorkspaceCacheScope): T | null {
  const entry = store.get(cacheKey(projectId, scope)) as CacheEntry<T> | undefined;
  return entry?.data ?? null;
}

export function writeWorkspaceCache<T>(
  projectId: string,
  scope: WorkspaceCacheScope,
  data: T
): void {
  store.set(cacheKey(projectId, scope), { data, fetchedAt: Date.now() });
}

export function getWorkspaceCacheAge(projectId: string, scope: WorkspaceCacheScope): number | null {
  const entry = store.get(cacheKey(projectId, scope));
  if (!entry) return null;
  return Date.now() - entry.fetchedAt;
}

export function isWorkspaceCacheFresh(
  projectId: string,
  scope: WorkspaceCacheScope,
  maxAgeMs: number
): boolean {
  const age = getWorkspaceCacheAge(projectId, scope);
  return age != null && age < maxAgeMs;
}

export function invalidateWorkspaceCache(
  projectId: string,
  scope?: WorkspaceCacheScope | 'all'
): void {
  if (!scope || scope === 'all') {
    for (const key of store.keys()) {
      if (key.startsWith(`workspace:${projectId}:`)) {
        store.delete(key);
      }
    }
    return;
  }
  store.delete(cacheKey(projectId, scope));
}

/** Stale-while-revalidate: returns cached data immediately if present; caller still revalidates. */
export function peekStaleWorkspaceCache<T>(
  projectId: string,
  scope: WorkspaceCacheScope
): { data: T; ageMs: number } | null {
  const key = cacheKey(projectId, scope);
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  return { data: entry.data, ageMs: Date.now() - entry.fetchedAt };
}
