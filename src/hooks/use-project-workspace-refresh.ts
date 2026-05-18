'use client';

import * as React from 'react';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import type { WorkspaceRefreshScope } from '@/lib/projects/workspace-refresh-controller';
import { projectTabFromPathname } from '@/lib/projects/project-routes';
import { usePathname } from 'next/navigation';

const ACTIVE_INTERVAL_MS = 12_000;
const IDLE_INTERVAL_MS = 45_000;
const HIDDEN_PAUSE_MS = 60_000;
const IDLE_AFTER_MS = 90_000;

/**
 * Centralized refresh API for project workspace sections.
 */
export function useProjectWorkspaceRefresh() {
  const ctx = useProjectWorkspace();

  return React.useMemo(
    () => ({
      refresh: (scope?: WorkspaceRefreshScope) =>
        ctx.refresh({ force: true, scope: scope ?? 'all', silent: false }),
      refreshSilent: (scope?: WorkspaceRefreshScope) => ctx.refreshSilent(scope ?? 'participants'),
      invalidate: ctx.invalidate,
      lastRefreshAt: ctx.lastRefreshAt,
      isRefreshing: ctx.isRefreshing,
    }),
    [ctx]
  );
}

/**
 * Smart background refresh: visibility-aware, activity-aware, throttled via controller.
 */
export function useProjectWorkspaceSmartPolling(options?: {
  enabled?: boolean;
  scope?: WorkspaceRefreshScope;
}) {
  const { projectId, refreshSilent, deal } = useProjectWorkspace();
  const pathname = usePathname() ?? '';
  const enabled = (options?.enabled ?? true) && Boolean(deal?.id);
  const scope = options?.scope;

  const scopeForTab = React.useMemo((): WorkspaceRefreshScope => {
    if (scope) return scope;
    const tab = projectTabFromPathname(pathname, projectId);
    if (tab === 'participants') return 'participants';
    if (tab === 'overview') return 'summary';
    return 'all';
  }, [scope, pathname, projectId]);

  const lastActivityRef = React.useRef(Date.now());
  const hiddenSinceRef = React.useRef<number | null>(null);
  const refreshRef = React.useRef(refreshSilent);
  refreshRef.current = refreshSilent;

  React.useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now();
        return;
      }
      hiddenSinceRef.current = null;
      lastActivityRef.current = Date.now();
      void refreshRef.current(scopeForTab);
    };

    window.addEventListener('mousemove', markActive, { passive: true });
    window.addEventListener('keydown', markActive, { passive: true });
    window.addEventListener('focus', markActive);
    document.addEventListener('visibilitychange', onVisibility);

    const tick = () => {
      const now = Date.now();

      if (document.visibilityState === 'hidden') {
        if (hiddenSinceRef.current == null) hiddenSinceRef.current = now;
        if (now - hiddenSinceRef.current > HIDDEN_PAUSE_MS) {
          return;
        }
      } else {
        hiddenSinceRef.current = null;
      }

      const idle = now - lastActivityRef.current > IDLE_AFTER_MS;
      const interval = idle ? IDLE_INTERVAL_MS : ACTIVE_INTERVAL_MS;
      void refreshRef.current(scopeForTab);

      return interval;
    };

    let timeoutId: ReturnType<typeof globalThis.setTimeout>;
    const schedule = (delay: number) => {
      timeoutId = globalThis.setTimeout(() => {
        const next = tick();
        schedule(typeof next === 'number' ? next : ACTIVE_INTERVAL_MS);
      }, delay);
    };

    schedule(ACTIVE_INTERVAL_MS);

    return () => {
      globalThis.clearTimeout(timeoutId);
      window.removeEventListener('mousemove', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('focus', markActive);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, scopeForTab]);
}
