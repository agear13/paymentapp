import type { OperationalSyncPayload } from '@/lib/operations/sync/operational-sync-types';

export function parseOperationalSync(json: unknown): OperationalSyncPayload | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const raw = (json as { operationalSync?: OperationalSyncPayload }).operationalSync;
  if (!raw || typeof raw !== 'object') return undefined;
  return raw;
}
