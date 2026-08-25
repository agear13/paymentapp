'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  AgreementIntelligenceConfiguration,
  WorkflowAgreementHubSummary,
  WorkflowAgreementRecord,
  WorkflowOperationalHubSummary,
} from '@/lib/workflows/agreement-intelligence/types';
import type { OrganizationWorkflowLifecycleStatus } from '@prisma/client';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import type { ParticipantCoordinationAction } from '@/lib/workflows/agreement-intelligence/participant-coordination';

export type WorkflowAgreementContext = {
  workflowId: string;
  lifecycleStatus: OrganizationWorkflowLifecycleStatus;
  configuration: AgreementIntelligenceConfiguration;
  agreement: WorkflowAgreementRecord | null;
  hubSummary: WorkflowAgreementHubSummary;
  operationalSummary: WorkflowOperationalHubSummary | null;
  operatorEmail?: string | null;
};

export function useWorkflowAgreement(
  workflowId: string | null,
  agreementId?: string | null,
  options?: { skipInitialFetch?: boolean }
) {
  const skipInitialFetch = options?.skipInitialFetch === true;
  const [context, setContext] = useState<WorkflowAgreementContext | null>(null);
  const [loading, setLoading] = useState(!skipInitialFetch);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coordinating, setCoordinating] = useState(false);

  const agreementQuery = agreementId
    ? `?agreementId=${encodeURIComponent(agreementId)}`
    : '';

  const refresh = useCallback(async () => {
    if (!workflowId) {
      setContext(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/agreement${agreementQuery}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? 'Failed to load agreement workflow');
        setContext(null);
        return;
      }
      const data = (await res.json()) as WorkflowAgreementContext;
      setContext(data);
    } catch {
      setError('Failed to load agreement workflow');
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [workflowId, agreementQuery]);

  useEffect(() => {
    if (skipInitialFetch) return;
    void refresh();
  }, [refresh, skipInitialFetch]);

  const submitPaste = useCallback(
    async (text: string, title?: string) => {
      if (!workflowId) return false;
      setSubmitting(true);
      setError(null);
      try {
        const res = await csrfAwareFetch(`/api/workflows/${workflowId}/agreement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text, title }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? 'Failed to submit agreement');
          return false;
        }
        const data = (await res.json()) as WorkflowAgreementContext;
        setContext(data);
        return data.agreement?.id ?? false;
      } catch {
        setError('Failed to submit agreement');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [workflowId]
  );

  const submitUpload = useCallback(
    async (file: File) => {
      if (!workflowId) return false;
      setSubmitting(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await csrfAwareFetch(`/api/workflows/${workflowId}/agreement`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? 'Failed to upload agreement');
          return false;
        }
        const data = (await res.json()) as WorkflowAgreementContext;
        setContext(data);
        return data.agreement?.id ?? false;
      } catch {
        setError('Failed to upload agreement');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [workflowId]
  );

  const retryExtraction = useCallback(async () => {
    if (!workflowId) return false;
    setSubmitting(true);
    setError(null);
    try {
      const res = await csrfAwareFetch(`/api/workflows/${workflowId}/agreement`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'extract',
          force: true,
          ...(agreementId ? { agreementId } : {}),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? 'Extraction failed');
        await refresh();
        return false;
      }
      const data = (await res.json()) as WorkflowAgreementContext;
      setContext(data);
      return true;
    } catch {
      setError('Extraction failed');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [workflowId, agreementId, refresh]);

  const updateConfiguration = useCallback(
    async (configuration: AgreementIntelligenceConfiguration) => {
      if (!workflowId) return false;
      setSubmitting(true);
      setError(null);
      try {
        const res = await csrfAwareFetch(`/api/workflows/${workflowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ configuration }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? 'Failed to update configuration');
          return false;
        }
        await refresh();
        return true;
      } catch {
        setError('Failed to update configuration');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [workflowId, refresh]
  );

  const retryBootstrap = useCallback(async () => {
    if (!workflowId) return false;
    setSubmitting(true);
    setError(null);
    try {
      const res = await csrfAwareFetch(`/api/workflows/${workflowId}/agreement`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'bootstrap',
          ...(agreementId ? { agreementId } : {}),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? 'Activation failed');
        await refresh();
        return false;
      }
      const data = (await res.json()) as WorkflowAgreementContext;
      setContext(data);
      return true;
    } catch {
      setError('Activation failed');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [workflowId, agreementId, refresh]);

  const shareExtraction = useCallback(
    async (to: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!workflowId) return { ok: false, error: 'Workflow is not available.' };
      try {
        const res = await csrfAwareFetch(`/api/workflows/${workflowId}/agreement/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ to, ...(agreementId ? { agreementId } : {}) }),
        });
        const payload = (await res.json().catch(() => null)) as
          | { sent?: boolean; error?: string }
          | null;
        if (!res.ok || payload?.sent !== true) {
          return {
            ok: false,
            error: payload?.error ?? 'Could not send the extraction email.',
          };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Could not send the extraction email.' };
      }
    },
    [workflowId, agreementId]
  );

  const startNew = useCallback(async () => {
    if (!workflowId) return false;
    setSubmitting(true);
    setError(null);
    try {
      const res = await csrfAwareFetch(`/api/workflows/${workflowId}/agreement`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'start_new' }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? 'Could not start a new extraction');
        return false;
      }
      const data = (await res.json()) as WorkflowAgreementContext;
      setContext(data);
      return true;
    } catch {
      setError('Could not start a new extraction');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [workflowId]);

  const coordinateParticipant = useCallback(
    async (
      participantId: string,
      action: ParticipantCoordinationAction,
      extra?: { missingFields?: string[]; requestedChanges?: string; sendInvitationEmail?: boolean }
    ) => {
      if (!workflowId) return { ok: false };
      setCoordinating(true);
      setError(null);
      try {
        const res = await csrfAwareFetch(
          `/api/workflows/${workflowId}/agreement/participants/${participantId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              action,
              ...extra,
              ...(agreementId ? { agreementId } : {}),
            }),
          }
        );
        const payload = (await res.json().catch(() => null)) as
          | (WorkflowAgreementContext & {
              error?: string;
              coordination?: { invitationEmailSent?: boolean };
            })
          | null;
        if (!res.ok) {
          setError(payload?.error ?? 'Participant coordination failed');
          return { ok: false };
        }
        setContext(payload as WorkflowAgreementContext);
        return { ok: true, invitationEmailSent: payload?.coordination?.invitationEmailSent };
      } catch {
        setError('Participant coordination failed');
        return { ok: false };
      } finally {
        setCoordinating(false);
      }
    },
    [workflowId, agreementId]
  );

  return {
    context,
    loading,
    error,
    submitting,
    coordinating,
    refresh,
    submitPaste,
    submitUpload,
    retryExtraction,
    retryBootstrap,
    updateConfiguration,
    coordinateParticipant,
    shareExtraction,
    startNew,
  };
}
