/**
 * Operational chunk load recovery — stale deploy detection and safe reload.
 */

import { logOperationalError } from '@/lib/operational/log-operational-error';

export const CHUNK_RELOAD_SESSION_KEY = 'operational_chunk_reload_v1';

export type ChunkRecoveryPhase = 'idle' | 'recovering' | 'failed';

export type ChunkRecoveryState = {
  phase: ChunkRecoveryPhase;
  message: string;
};

export function isChunkLoadError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('chunk mismatch') ||
    (msg.includes('timeout') && msg.includes('chunk'))
  );
}

export function isScriptChunkError(event: Event): boolean {
  const target = event.target;
  if (!(target instanceof HTMLScriptElement)) return false;
  const src = target.src ?? '';
  return src.includes('/_next/static/chunks/');
}

export function hasChunkReloadBeenAttempted(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY) != null;
}

export function markChunkReloadAttempted(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, String(Date.now()));
}

export function clearChunkReloadAttempt(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
}

export async function fetchServerBuildId(): Promise<string | null> {
  try {
    const response = await fetch('/api/build-info', { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = (await response.json()) as { buildId?: string };
    return payload.buildId ?? null;
  } catch {
    return null;
  }
}

export type ChunkRecoveryDecision =
  | { action: 'reload'; reason: 'stale_deploy' | 'chunk_timeout' }
  | { action: 'fail'; reason: 'already_retried' | 'not_chunk_error' };

export async function decideChunkRecovery(
  error: unknown,
  clientBuildId: string | null
): Promise<ChunkRecoveryDecision> {
  if (!isChunkLoadError(error)) {
    return { action: 'fail', reason: 'not_chunk_error' };
  }

  if (hasChunkReloadBeenAttempted()) {
    return { action: 'fail', reason: 'already_retried' };
  }

  const serverBuildId = await fetchServerBuildId();
  if (serverBuildId && clientBuildId && serverBuildId !== clientBuildId) {
    return { action: 'reload', reason: 'stale_deploy' };
  }

  return { action: 'reload', reason: 'chunk_timeout' };
}

export function logChunkRecoveryError(error: unknown, context: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  logOperationalError(err, { component: context, route: 'chunk-recovery' });
}

export const OPERATIONAL_WORKSPACE_UPDATING_MESSAGE = 'Updating operational workspace…';
