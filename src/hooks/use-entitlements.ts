'use client';

import * as React from 'react';
import type {
  EntitlementFeature,
  SubscriptionPlan,
  WorkspaceEntitlements,
} from '@/lib/entitlements/types';
import type { EntitlementDecision } from '@/lib/entitlements/types';

type EntitlementsResponse = WorkspaceEntitlements & {
  organizationId: string;
};

const entitlementsCache: {
  data: EntitlementsResponse | null;
  promise: Promise<EntitlementsResponse | null> | null;
} = { data: null, promise: null };

async function fetchEntitlements(): Promise<EntitlementsResponse | null> {
  const res = await fetch('/api/entitlements', { credentials: 'include' });
  if (!res.ok) return null;
  const json = await res.json();
  return (json.data ?? json) as EntitlementsResponse;
}

export function invalidateEntitlementsCache(): void {
  entitlementsCache.data = null;
  entitlementsCache.promise = null;
}

export function useEntitlements() {
  const [data, setData] = React.useState<EntitlementsResponse | null>(entitlementsCache.data);
  const [loading, setLoading] = React.useState(!entitlementsCache.data);

  React.useEffect(() => {
    if (entitlementsCache.data) {
      setData(entitlementsCache.data);
      setLoading(false);
      return;
    }

    if (!entitlementsCache.promise) {
      entitlementsCache.promise = fetchEntitlements().then((result) => {
        entitlementsCache.data = result;
        entitlementsCache.promise = null;
        return result;
      });
    }

    entitlementsCache.promise.then((result) => {
      setData(result);
      setLoading(false);
    });
  }, []);

  const refresh = React.useCallback(async () => {
    invalidateEntitlementsCache();
    setLoading(true);
    const result = await fetchEntitlements();
    entitlementsCache.data = result;
    setData(result);
    setLoading(false);
    return result;
  }, []);

  const isAllowed = React.useCallback(
    (feature: EntitlementFeature): boolean => {
      if (!data) return true;
      if (data.pilotBypass) return true;
      return data.features[feature]?.allowed ?? true;
    },
    [data]
  );

  const getDecision = React.useCallback(
    (feature: EntitlementFeature): EntitlementDecision | null => {
      if (!data) return null;
      return data.features[feature] ?? null;
    },
    [data]
  );

  return {
    entitlements: data,
    loading,
    refresh,
    isAllowed,
    getDecision,
    plan: (data?.plan ?? 'starter') as SubscriptionPlan,
    pilotBypass: data?.pilotBypass ?? false,
    usage: data?.usage,
  };
}

export async function trackEntitlementAnalytics(
  event:
    | 'feature_gate_viewed'
    | 'upgrade_prompt_opened'
    | 'upgrade_clicked'
    | 'plan_selected'
    | 'plan_changed',
  payload: Record<string, string | undefined>
): Promise<void> {
  try {
    await fetch('/api/entitlements/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ event, ...payload }),
    });
  } catch {
    // non-blocking
  }
}
