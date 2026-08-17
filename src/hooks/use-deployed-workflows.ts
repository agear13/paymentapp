'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrganizationWorkflowWithTemplate } from '@/lib/workflows/types';
import { WorkspaceFeature } from '@/lib/workspace-features/types';

type WorkflowsPayload = {
  workflows: OrganizationWorkflowWithTemplate[];
  enabledFeatures: WorkspaceFeature[];
};

export function useDeployedWorkflows() {
  const [workflows, setWorkflows] = useState<OrganizationWorkflowWithTemplate[]>([]);
  const [enabledFeatures, setEnabledFeatures] = useState<WorkspaceFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workflows');
      if (!res.ok) {
        setWorkflows([]);
        setEnabledFeatures([]);
        if (res.status === 401 || res.status === 403) {
          setError(null);
          return;
        }
        setError('Failed to load workflows');
        return;
      }
      const data = (await res.json()) as WorkflowsPayload;
      setWorkflows(data.workflows ?? []);
      setEnabledFeatures(data.enabledFeatures ?? []);
    } catch {
      setError('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isInstalled = useCallback(
    (templateSlug: string) => workflows.some((w) => w.templateSlug === templateSlug),
    [workflows]
  );

  const getBySlug = useCallback(
    (templateSlug: string) => workflows.find((w) => w.templateSlug === templateSlug) ?? null,
    [workflows]
  );

  return {
    workflows,
    enabledFeatures,
    loading,
    error,
    refresh,
    isInstalled,
    getBySlug,
  };
}
