'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrganizationWorkflowLifecycleStatus } from '@prisma/client';
import type { AgreementCollectionItem } from '@/lib/workflows/agreement-intelligence/types';

export type WorkflowAgreementList = {
  workflowId: string;
  lifecycleStatus: OrganizationWorkflowLifecycleStatus;
  currentAgreementId: string | null;
  canStartNew: boolean;
  agreements: AgreementCollectionItem[];
};

export function useWorkflowAgreementList(workflowId: string | null) {
  const [data, setData] = useState<WorkflowAgreementList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workflowId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/agreements`, { credentials: 'include' });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? 'Failed to load agreements');
        setData(null);
        return;
      }
      setData((await res.json()) as WorkflowAgreementList);
    } catch {
      setError('Failed to load agreements');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
