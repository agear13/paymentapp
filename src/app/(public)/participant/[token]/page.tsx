'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ParticipantCommercialWorkspaceView } from '@/components/participant-portal/participant-portal-view';
import type { ParticipantCommercialWorkspaceModel } from '@/lib/participant-portal/participant-portal-data';
import type { CommercialWorkspaceSection } from '@/lib/participant-portal/participant-portal-types';

const REFRESH_INTERVAL_MS = 30_000;

export default function ParticipantPortalPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? '');

  const [workspace, setWorkspace] = React.useState<ParticipantCommercialWorkspaceModel | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<CommercialWorkspaceSection>('overview');

  const fetchWorkspace = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return;
      if (!options?.silent) setLoading(true);
      else setRefreshing(true);
      setLoadError(null);

      try {
        const res = await fetch(`/api/participant-portal/${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Portal not found');
        }
        const data = (await res.json()) as { workspace: ParticipantCommercialWorkspaceModel };
        setWorkspace(data.workspace);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to load workspace';
        if (!options?.silent) setLoadError(message);
      } finally {
        if (!options?.silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  React.useEffect(() => {
    if (!token) {
      setLoading(false);
      setLoadError('Missing portal token');
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
        <p className="text-sm text-muted-foreground">Loading your commercial workspace…</p>
      </div>
    );
  }

  if (loadError || !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Workspace link not found</CardTitle>
            <CardDescription>
              {loadError || 'This commercial workspace link is invalid or no longer exists.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <ParticipantCommercialWorkspaceView
      workspace={workspace}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onRefresh={() => void fetchWorkspace({ silent: true })}
      isRefreshing={refreshing}
    />
  );
}
