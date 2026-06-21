import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import { MARKETING_JOBS_STORAGE_KEY_PREFIX } from '@/lib/marketing-jobs/constants';

export type MarketingJobStoreListener = (state: MarketingWorkspaceState) => void;

export interface MarketingJobStore {
  getState(): MarketingWorkspaceState;
  setState(state: MarketingWorkspaceState): void;
  subscribe(listener: MarketingJobStoreListener): () => void;
}

export function createLocalMarketingJobStore(initialState: MarketingWorkspaceState): MarketingJobStore {
  const storageKey = `${MARKETING_JOBS_STORAGE_KEY_PREFIX}${initialState.companyId}`;
  const listeners = new Set<MarketingJobStoreListener>();

  function readPersisted(): MarketingWorkspaceState | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as MarketingWorkspaceState;
    } catch {
      return null;
    }
  }

  function writePersisted(state: MarketingWorkspaceState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }

  let state: MarketingWorkspaceState = readPersisted() ?? initialState;

  function emit(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState() {
      return state;
    },
    setState(next) {
      state = next;
      writePersisted(state);
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
