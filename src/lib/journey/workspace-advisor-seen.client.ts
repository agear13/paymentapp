const WORKSPACE_ADVISOR_SEEN_KEY = 'provvy.workspaceAdvisorSeen';

/**
 * Persistence for the first Workspace Advisor introduction.
 * localStorage is the first-pass store. Swap the implementation later for
 * server-side user/workspace state without changing callers.
 */
export type WorkspaceAdvisorSeenStore = {
  hasSeen(): boolean;
  markSeen(): void;
};

export function createLocalWorkspaceAdvisorSeenStore(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window === 'undefined'
    ? null
    : window.localStorage
): WorkspaceAdvisorSeenStore {
  return {
    hasSeen() {
      if (!storage) return false;
      try {
        return storage.getItem(WORKSPACE_ADVISOR_SEEN_KEY) === '1';
      } catch {
        return false;
      }
    },
    markSeen() {
      if (!storage) return;
      try {
        storage.setItem(WORKSPACE_ADVISOR_SEEN_KEY, '1');
      } catch {
        /* ignore quota / privacy mode */
      }
    },
  };
}

let activeStore: WorkspaceAdvisorSeenStore = createLocalWorkspaceAdvisorSeenStore();

export function getWorkspaceAdvisorSeenStore(): WorkspaceAdvisorSeenStore {
  return activeStore;
}

/** @internal */
export function setWorkspaceAdvisorSeenStoreForTests(store: WorkspaceAdvisorSeenStore): void {
  activeStore = store;
}

/** @internal */
export function resetWorkspaceAdvisorSeenStoreForTests(): void {
  activeStore = createLocalWorkspaceAdvisorSeenStore();
}

export const WORKSPACE_ADVISOR_SEEN_STORAGE_KEY = WORKSPACE_ADVISOR_SEEN_KEY;
