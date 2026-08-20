'use client';

import { useCallback, useEffect, useState } from 'react';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import type { ParticipantCoordinationAction } from '@/lib/workflows/agreement-intelligence/participant-coordination';
import type { ReferralManagementContext } from '@/lib/workflows/referral-management/hub.server';
import type { ReferralImportPreview } from '@/lib/workflows/referral-management/import-from-extraction';

export type AddPromoterInput = {
  name: string;
  email: string;
  phone?: string;
  role: 'Promoter' | 'Affiliate' | 'Partner' | 'Other';
  compensation:
    | { kind: 'revenue_share'; percentage: number; serviceId: string }
    | { kind: 'fixed'; amount: number; currency: string; serviceId: string };
  reuseExisting?: boolean;
};

export type AddPromoterResult = {
  ok: boolean;
  participantId?: string;
  reused?: boolean;
};

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
    async (body: AddPromoterInput): Promise<AddPromoterResult> => {
      if (!workflowId) return { ok: false };
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
          | {
              error?: string;
              context?: ReferralManagementContext;
              participant?: { id?: string };
              reused?: boolean;
            }
          | null;
        if (!res.ok) {
          setError(payload?.error ?? 'Could not add promoter');
          return { ok: false };
        }
        if (payload?.context) setContext(payload.context);
        return {
          ok: true,
          participantId: payload?.participant?.id,
          reused: Boolean(payload?.reused),
        };
      } catch {
        setError('Could not add promoter');
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [workflowId]
  );

  const extractReferralRelationships = useCallback(
    async (input: { text: string; sourceLabel?: string } | { file: File }): Promise<ReferralImportPreview | null> => {
      if (!workflowId) return null;
      setBusy(true);
      setError(null);
      try {
        const res =
          'file' in input
            ? await csrfAwareFetch(`/api/workflows/${workflowId}/referrals/extract`, {
                method: 'POST',
                credentials: 'include',
                body: (() => {
                  const form = new FormData();
                  form.set('file', input.file);
                  return form;
                })(),
              })
            : await csrfAwareFetch(`/api/workflows/${workflowId}/referrals/extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text: input.text, sourceLabel: input.sourceLabel }),
              });
        const payload = (await res.json().catch(() => null)) as
          | (ReferralImportPreview & { error?: string; message?: string })
          | null;
        if (!res.ok) {
          setError(payload?.error ?? payload?.message ?? 'Could not extract a referral relationship');
          return null;
        }
        return payload as ReferralImportPreview;
      } catch {
        setError('Could not extract a referral relationship');
        return null;
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

  return {
    context,
    loading,
    error,
    busy,
    refresh,
    addPromoter,
    extractReferralRelationships,
    coordinatePromoter,
  };
}
