'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ParticipantWorkspaceGate } from '@/components/participant-portal/participant-workspace-gate';
import {
  ParticipantAccessDenied,
  ParticipantAuthGate,
  type ParticipantInvitationPreview,
} from '@/components/participant-portal/participant-auth-gate';
import { CsrfBootstrap } from '@/components/security/csrf-bootstrap';
import {
  reloadParticipantInvitation,
  signOutParticipantSession,
} from '@/lib/participant-portal/participant-sign-out.client';
import {
  buildAuthCallbackForwardUrl,
  participantUrlNeedsAuthCallback,
} from '@/lib/participant-portal/participant-magic-link';
import type { ParticipantCommercialWorkspaceModel } from '@/lib/participant-portal/participant-portal-data';
import type { ParticipantWorkspaceOnboarding } from '@/lib/participant-portal/participant-workspace-onboarding';

type AuthStatus = 'unauthenticated' | 'denied' | 'authorized';

type WorkspacePayload = {
  auth?: {
    status: AuthStatus;
    role?: 'participant' | 'operator_preview';
    signedInEmail?: string | null;
  };
  invitation?: ParticipantInvitationPreview;
  workspace?: ParticipantCommercialWorkspaceModel | null;
  onboarding?: ParticipantWorkspaceOnboarding;
  paymentSetupToken?: string | null;
  inviteToken?: string;
};

const REFRESH_INTERVAL_MS = 30_000;

export default function ParticipantWorkspacePage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = String(params?.token ?? '');
  const previewMode = searchParams?.get('mode') === 'preview';
  const urlStep = searchParams?.get('step');
  const recoveredFromWrongAccount = searchParams?.get('recover') === '1';
  const signedOut = searchParams?.get('signedOut') === '1';

  const [payload, setPayload] = React.useState<WorkspacePayload | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [forwardingAuth, setForwardingAuth] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [deniedEmail, setDeniedEmail] = React.useState<string | null>(null);

  const fetchWorkspace = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return;
      if (!options?.silent) setLoading(true);
      else setRefreshing(true);
      setLoadError(null);

      try {
        const res = await fetch(
          `/api/participant-portal/${encodeURIComponent(token)}${urlStep ? `?step=${encodeURIComponent(urlStep)}` : ''}`,
          { cache: 'no-store', credentials: 'include' }
        );
        const data = (await res.json()) as WorkspacePayload & { error?: string };
        if (res.status === 403) {
          setDeniedEmail(data.auth?.signedInEmail ?? null);
          setPayload({
            auth: { status: 'denied', signedInEmail: data.auth?.signedInEmail },
          });
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || 'Workspace not found');
        }
        setDeniedEmail(null);
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
    if (!token) return;
    if (typeof window === 'undefined') return;
    if (!participantUrlNeedsAuthCallback(window.location.search, window.location.hash)) return;
    setForwardingAuth(true);
    window.location.replace(
      buildAuthCallbackForwardUrl({
        participantPath: `/participant/${token}`,
        search: window.location.search,
        hash: window.location.hash,
      })
    );
  }, [token]);

  React.useEffect(() => {
    if (!token) {
      setLoading(false);
      setLoadError('Missing workspace token');
      return;
    }
    if (forwardingAuth) return;
    void fetchWorkspace();
  }, [token, fetchWorkspace, forwardingAuth]);

  React.useEffect(() => {
    if (!token || loadError || payload?.auth?.status !== 'authorized') return;
    const id = window.setInterval(() => {
      void fetchWorkspace({ silent: true });
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [token, loadError, fetchWorkspace, payload?.auth?.status]);

  const recoverInvitedSession = React.useCallback(async () => {
    setLoading(true);
    await signOutParticipantSession();
    reloadParticipantInvitation(token, true);
  }, [token]);

  const handleSignOut = React.useCallback(async () => {
    setLoading(true);
    await signOutParticipantSession();
    reloadParticipantInvitation(token, false);
  }, [token]);

  if (forwardingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading your participant workspace…</p>
      </div>
    );
  }

  if (payload?.auth?.status === 'unauthenticated' && payload.invitation) {
    return (
      <ParticipantAuthGate
        token={token}
        invitation={payload.invitation}
        recoveredFromWrongAccount={recoveredFromWrongAccount}
        signedOut={signedOut}
      />
    );
  }

  if (payload?.auth?.status === 'denied') {
    return (
      <ParticipantAccessDenied
        signedInEmail={deniedEmail ?? payload.auth.signedInEmail}
        onSignInWithInvitedAccount={() => void recoverInvitedSession()}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  if (loadError || !payload || payload.auth?.status !== 'authorized' || !payload.onboarding || !payload.inviteToken) {
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
    <>
      <CsrfBootstrap />
      <ParticipantWorkspaceGate
      portalToken={token}
      bootstrap={{
        onboarding: payload.onboarding,
        inviteToken: payload.inviteToken,
        workspace: payload.workspace ?? null,
        paymentSetupToken: payload.paymentSetupToken ?? null,
      }}
      previewMode={previewMode || payload.auth.role === 'operator_preview'}
      signedInEmail={payload.auth.signedInEmail}
      onSignOut={() => void handleSignOut()}
      onRefresh={() => fetchWorkspace({ silent: true })}
      isRefreshing={refreshing}
    />
    </>
  );
}
