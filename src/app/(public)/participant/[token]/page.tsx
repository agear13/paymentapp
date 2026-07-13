'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ParticipantWorkspaceGate } from '@/components/participant-portal/participant-workspace-gate';
import type { ParticipantCommercialWorkspaceModel } from '@/lib/participant-portal/participant-portal-data';
import type { ParticipantWorkspaceOnboarding } from '@/lib/participant-portal/participant-workspace-onboarding';

type WorkspacePayload = {
  workspace: ParticipantCommercialWorkspaceModel | null;
  onboarding: ParticipantWorkspaceOnboarding;
  paymentSetupToken: string | null;
  inviteToken: string;
};

const REFRESH_INTERVAL_MS = 30_000;

export default function ParticipantWorkspacePage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = String(params?.token ?? '');
  const previewMode = searchParams?.get('mode') === 'preview';
  const urlStep = searchParams?.get('step');

  const [payload, setPayload] = React.useState<WorkspacePayload | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchWorkspace = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return;
      if (!options?.silent) setLoading(true);
      else setRefreshing(true);
      setLoadError(null);

      try {
        const res = await fetch(
          `/api/participant-portal/${encodeURIComponent(token)}${urlStep ? `?step=${encodeURIComponent(urlStep)}` : ''}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Workspace not found');
        }
        const data = (await res.json()) as WorkspacePayload;
        setPayload(data);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to load workspace';
        if (!options?.silent) setLoadError(message);
      } finally {
        if (!options?.silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [token, urlStep]
  );

  React.useEffect(() => {
    if (!token) {
      setLoading(false);
      setLoadError('Missing workspace token');
      return;
    }
    void fetchWorkspace();
  }, [token, fetchWorkspace]);

  React.useEffect(() => {
    if (!token || loadError) return;
    const id = window.setInterval(() => {
      void fetchWorkspace({ silent: true });
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [token, loadError, fetchWorkspace]);

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchWorkspace({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchWorkspace]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading your participant workspace…</p>
      </div>
    );
  }

  if (loadError || !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Workspace link not found</CardTitle>
            <CardDescription>
              {loadError || 'This participant workspace link is invalid or no longer exists.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <ParticipantWorkspaceGate
      portalToken={token}
      bootstrap={{
        onboarding: payload.onboarding,
        inviteToken: payload.inviteToken,
        workspace: payload.workspace,
        paymentSetupToken: payload.paymentSetupToken,
      }}
      previewMode={previewMode}
      onRefresh={() => fetchWorkspace({ silent: true })}
      isRefreshing={refreshing}
    />
  );
}
