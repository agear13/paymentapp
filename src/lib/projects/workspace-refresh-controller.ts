import {
  invalidateWorkspaceCache,
  isWorkspaceCacheFresh,
  peekStaleWorkspaceCache,
  writeWorkspaceCache,
  type WorkspaceCacheScope,
} from '@/lib/projects/workspace-query-cache';
import {
  fetchWorkspaceParticipants,
  fetchWorkspaceSummary,
  type WorkspaceParticipantsResponse,
  type WorkspaceSummaryResponse,
} from '@/lib/projects/workspace-fetch';
import { devRecordDuplicateFetch, devRecordWorkspaceRefresh } from '@/lib/projects/workspace-dev-diagnostics';

export type WorkspaceRefreshScope = 'all' | 'summary' | 'participants';

export type WorkspaceRefreshOptions = {
  silent?: boolean;
  force?: boolean;
  scope?: WorkspaceRefreshScope;
};

const MIN_SILENT_INTERVAL_MS = 2_000;
const FRESH_SUMMARY_MS = 8_000;
const FRESH_PARTICIPANTS_MS = 5_000;

export type WorkspaceRefreshListeners = {
  onSummary: (data: WorkspaceSummaryResponse | null, notFound: boolean) => void;
  onParticipants: (data: WorkspaceParticipantsResponse | null, notFound: boolean) => void;
  onRefreshingChange: (isRefreshing: boolean) => void;
  onLoadingChange: (loading: boolean) => void;
  onLastRefresh: (at: Date) => void;
  onError: (scope: WorkspaceCacheScope, error: Error) => void;
};

export class ProjectWorkspaceRefreshController {
  private projectId: string;
  private listeners: WorkspaceRefreshListeners;
  private abortController: AbortController | null = null;
  private inFlight: Promise<void> | null = null;
  private lastSilentAt = 0;
  private pendingScopes = new Set<WorkspaceRefreshScope>();
  private queued = false;

  constructor(projectId: string, listeners: WorkspaceRefreshListeners) {
    this.projectId = projectId;
    this.listeners = listeners;
  }

  dispose() {
    this.abortController?.abort();
    this.abortController = null;
    this.inFlight = null;
    this.pendingScopes.clear();
  }

  invalidate(scope?: WorkspaceCacheScope | 'all') {
    invalidateWorkspaceCache(this.projectId, scope ?? 'all');
  }

  refresh(options?: WorkspaceRefreshOptions): Promise<void> {
    const scope = options?.scope ?? 'all';
    const silent = options?.silent === true;
    const force = options?.force === true;

    if (!force && silent) {
      const now = Date.now();
      if (now - this.lastSilentAt < MIN_SILENT_INTERVAL_MS) {
        this.pendingScopes.add(scope);
        if (!this.queued) {
          this.queued = true;
          const delay = MIN_SILENT_INTERVAL_MS - (now - this.lastSilentAt);
          globalThis.setTimeout(() => {
            this.queued = false;
            const merged: WorkspaceRefreshScope =
              this.pendingScopes.has('all') ||
              (this.pendingScopes.has('summary') && this.pendingScopes.has('participants'))
                ? 'all'
                : this.pendingScopes.has('participants')
                  ? 'participants'
                  : this.pendingScopes.has('summary')
                    ? 'summary'
                    : 'all';
            this.pendingScopes.clear();
            void this.refresh({ silent: true, force: true, scope: merged });
          }, delay);
        }
        return this.inFlight ?? Promise.resolve();
      }
      this.lastSilentAt = now;
    }

    if (this.inFlight && !force) {
      this.pendingScopes.add(scope);
      return this.inFlight;
    }

    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const run = async () => {
      devRecordWorkspaceRefresh(this.projectId);

      const needsSummary = scope === 'all' || scope === 'summary';
      const needsParticipants = scope === 'all' || scope === 'participants';

      if (!silent) {
        this.listeners.onLoadingChange(true);
      }
      this.listeners.onRefreshingChange(true);

      try {
        const tasks: Promise<void>[] = [];

        if (needsSummary) {
          tasks.push(this.loadSummary(signal, silent, force));
        }
        if (needsParticipants) {
          tasks.push(this.loadParticipants(signal, silent, force));
        }

        await Promise.all(tasks);
        if (!signal.aborted) {
          this.listeners.onLastRefresh(new Date());
        }
      } catch (e) {
        if (signal.aborted) return;
        const err = e instanceof Error ? e : new Error(String(e));
        if (needsSummary) this.listeners.onError('summary', err);
        if (needsParticipants) this.listeners.onError('participants', err);
      } finally {
        if (!signal.aborted) {
          this.listeners.onRefreshingChange(false);
          if (!silent) {
            this.listeners.onLoadingChange(false);
          }
        }
      }
    };

    this.inFlight = run().finally(() => {
      this.inFlight = null;
      if (this.pendingScopes.size > 0) {
        const merged: WorkspaceRefreshScope =
          this.pendingScopes.has('all') ? 'all' : 'participants';
        this.pendingScopes.clear();
        void this.refresh({ silent: true, force: true, scope: merged });
      }
    });

    return this.inFlight;
  }

  refreshSilent(scope: WorkspaceRefreshScope = 'participants') {
    return this.refresh({ silent: true, scope });
  }

  private async loadSummary(signal: AbortSignal, silent: boolean, force: boolean) {
    const scope: WorkspaceCacheScope = 'summary';

    if (!force && silent && isWorkspaceCacheFresh(this.projectId, scope, FRESH_SUMMARY_MS)) {
      const cached = peekStaleWorkspaceCache<WorkspaceSummaryResponse>(this.projectId, scope);
      if (cached) {
        devRecordDuplicateFetch(this.projectId, scope);
        this.listeners.onSummary(cached.data, false);
        return;
      }
    }

    const stale = peekStaleWorkspaceCache<WorkspaceSummaryResponse>(this.projectId, scope);
    if (stale && silent) {
      this.listeners.onSummary(stale.data, false);
    }

    const data = await fetchWorkspaceSummary(this.projectId, signal);
    if (signal.aborted) return;

    if (!data) {
      this.listeners.onSummary(null, true);
      return;
    }

    writeWorkspaceCache(this.projectId, scope, data);
    this.listeners.onSummary(data, false);
  }

  private async loadParticipants(signal: AbortSignal, silent: boolean, force: boolean) {
    const scope: WorkspaceCacheScope = 'participants';

    if (!force && silent && isWorkspaceCacheFresh(this.projectId, scope, FRESH_PARTICIPANTS_MS)) {
      const cached = peekStaleWorkspaceCache<WorkspaceParticipantsResponse>(this.projectId, scope);
      if (cached) {
        devRecordDuplicateFetch(this.projectId, scope);
        this.listeners.onParticipants(cached.data, false);
        return;
      }
    }

    const stale = peekStaleWorkspaceCache<WorkspaceParticipantsResponse>(this.projectId, scope);
    if (stale && silent) {
      this.listeners.onParticipants(stale.data, false);
    }

    const data = await fetchWorkspaceParticipants(this.projectId, signal);
    if (signal.aborted) return;

    if (!data) {
      this.listeners.onParticipants(null, true);
      return;
    }

    writeWorkspaceCache(this.projectId, scope, data);
    this.listeners.onParticipants(data, false);
  }
}
