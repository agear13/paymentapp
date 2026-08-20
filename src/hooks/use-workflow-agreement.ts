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
};

export function useWorkflowAgreement(workflowId: string | null) {
  const [context, setContext] = useState<WorkflowAgreementContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coordinating, setCoordinating] = useState(false);

  const refresh = useCallback(async () => {
    if (!workflowId) {
      setContext(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/agreement`, { credentials: 'include' });
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
  }, [workflowId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
        return true;
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
        return true;
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
        body: JSON.stringify({ action: 'extract', force: true }),
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
  }, [workflowId, refresh]);

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
        body: JSON.stringify({ action: 'bootstrap' }),
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
  }, [workflowId, refresh]);

  const coordinateParticipant = useCallback(
    async (
      participantId: string,
      action: ParticipantCoordinationAction,
      extra?: { missingFields?: string[]; requestedChanges?: string }
    ) => {
      if (!workflowId) return false;
      setCoordinating(true);
      setError(null);
      try {
        const res = await csrfAwareFetch(
          `/api/workflows/${workflowId}/agreement/participants/${participantId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action, ...extra }),
          }
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? 'Participant coordination failed');
          return false;
        }
        const data = (await res.json()) as WorkflowAgreementContext;
        setContext(data);
        return true;
      } catch {
        setError('Participant coordination failed');
        return false;
      } finally {
        setCoordinating(false);
      }
    },
    [workflowId]
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
  };
}
