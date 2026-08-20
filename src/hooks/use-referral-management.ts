'use client';

import { useCallback, useEffect, useState } from 'react';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import type { ParticipantCoordinationAction } from '@/lib/workflows/agreement-intelligence/participant-coordination';
import type { ReferralManagementContext } from '@/lib/workflows/referral-management/hub.server';

export function useReferralManagement(workflowId: string | null) {
  const [context, setContext] = useState<ReferralManagementContext | null>(null);
  const [loading, setLoading] = useState(Boolean(workflowId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const res = await csrfAwareFetch(`/api/workflows/${workflowId}/referrals`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? 'Failed to load Referral Management');
        return;
      }
      setContext((await res.json()) as ReferralManagementContext);
      setError(null);
    } catch {
      setError('Failed to load Referral Management');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addPromoter = useCallback(
    async (body: {
      name: string;
      email: string;
      phone?: string;
      role: 'Promoter' | 'Affiliate' | 'Partner' | 'Other';
      compensation:
        | { kind: 'revenue_share'; percentage: number; serviceId: string }
        | { kind: 'fixed'; amount: number; currency: string; serviceId: string };
    }) => {
      if (!workflowId) return false;
      setBusy(true);
      setError(null);
      try {
        const res = await csrfAwareFetch(`/api/workflows/${workflowId}/referrals/promoters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const payload = (await res.json().catch(() => null)) as
          | (ReferralManagementContext & { error?: string; context?: ReferralManagementContext })
          | null;
        if (!res.ok) {
          setError(payload?.error ?? 'Could not add promoter');
          return false;
        }
        setContext(payload?.context ?? (payload as ReferralManagementContext));
        return true;
      } catch {
        setError('Could not add promoter');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [workflowId]
  );

  const coordinatePromoter = useCallback(
    async (
      participantId: string,
      action: ParticipantCoordinationAction,
      extra?: { missingFields?: string[]; requestedChanges?: string }
    ) => {
      if (!workflowId) return false;
      setBusy(true);
      setError(null);
      try {
        const res = await csrfAwareFetch(
          `/api/workflows/${workflowId}/referrals/promoters/${participantId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action, ...extra }),
          }
        );
        const payload = (await res.json().catch(() => null)) as
          | (ReferralManagementContext & { error?: string })
          | null;
        if (!res.ok) {
          setError(payload?.error ?? 'Promoter coordination failed');
          return false;
        }
        setContext(payload as ReferralManagementContext);
        return true;
      } catch {
        setError('Promoter coordination failed');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [workflowId]
  );

  return { context, loading, error, busy, refresh, addPromoter, coordinatePromoter };
}
