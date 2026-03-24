import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export const PILOT_STORE_KEY = 'rh-deal-network-pilot-v1';

export interface PilotStoreData {
  deals: RecentDeal[];
  participants: DemoParticipant[];
}

export function loadPilotStore(): PilotStoreData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PILOT_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PilotStoreData;
    if (!Array.isArray(parsed.deals) || !Array.isArray(parsed.participants)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePilotStore(data: PilotStoreData) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PILOT_STORE_KEY, JSON.stringify(data));
}

