import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export interface PilotStoreData {
  deals: RecentDeal[];
  participants: DemoParticipant[];
}

/**
 * Load Rabbit Hole pilot snapshot for the current session user (Postgres via API).
 * localStorage is no longer used.
 */
export async function fetchPilotSnapshot(): Promise<PilotStoreData | null> {
  const res = await fetch('/api/deal-network-pilot/snapshot', {
    credentials: 'include',
    cache: 'no-store',
  });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return (await res.json()) as PilotStoreData;
}

/** Persist full pilot snapshot for the current user (replaces prior sync pattern). */
export async function persistPilotSnapshot(data: PilotStoreData): Promise<boolean> {
  const res = await fetch('/api/deal-network-pilot/snapshot', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
  });
  return res.ok;
}
