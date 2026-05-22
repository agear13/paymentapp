'use client';

import * as React from 'react';
import type { NextRecommendedAction } from '@/lib/onboarding/next-recommended-action';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';

export const WORKSPACE_ACTIVATION_REFRESH_EVENT = 'workspace-activation-refresh';

export function notifyWorkspaceActivationRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKSPACE_ACTIVATION_REFRESH_EVENT));
  }
}

type ActivationResponse = {
  activation: WorkspaceActivationSnapshot;
  nextAction: NextRecommendedAction;
};

export function useWorkspaceActivation(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const [data, setData] = React.useState<ActivationResponse | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [version, setVersion] = React.useState(0);

  const refresh = React.useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch('/api/workspace/activation', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: ActivationResponse };
        const payload = json.data ?? (json as unknown as ActivationResponse);
        if (!cancelled && payload?.activation) {
          setData(payload);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, version]);

  React.useEffect(() => {
    if (!enabled) return;
    const handler = () => refresh();
    window.addEventListener(WORKSPACE_ACTIVATION_REFRESH_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_ACTIVATION_REFRESH_EVENT, handler);
  }, [enabled, refresh]);

  return {
    activation: data?.activation ?? null,
    nextAction: data?.nextAction ?? null,
    loading,
    refresh,
  };
}
