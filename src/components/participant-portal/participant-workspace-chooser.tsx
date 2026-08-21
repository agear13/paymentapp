'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ParticipantLogoutButton } from '@/components/participant-portal/participant-logout-button';
import { signOutParticipantSession } from '@/lib/participant-portal/participant-sign-out.client';
import type { ParticipantWorkspaceChoice } from '@/lib/participant-portal/participant-workspace-choice';

export function ParticipantWorkspaceChooserPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [signedInEmail, setSignedInEmail] = React.useState<string | null>(null);
  const [workspaces, setWorkspaces] = React.useState<ParticipantWorkspaceChoice[] | null>(null);
  const [unauthenticated, setUnauthenticated] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/participant-portal/workspaces', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (res.status === 401) {
        setUnauthenticated(true);
        setWorkspaces(null);
        return;
      }
      const data = (await res.json()) as {
        signedInEmail?: string | null;
        workspaces?: ParticipantWorkspaceChoice[];
      };
      setUnauthenticated(false);
      setSignedInEmail(data.signedInEmail ?? null);
      setWorkspaces(data.workspaces ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (workspaces?.length === 1) {
      router.replace(workspaces[0].path);
    }
  }, [workspaces, router]);

  const handleSignOut = React.useCallback(async () => {
    await signOutParticipantSession();
    setWorkspaces(null);
    setSignedInEmail(null);
    setUnauthenticated(true);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading your participant workspaces…</p>
      </div>
    );
  }

  if (unauthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Participant workspace
            </p>
            <CardTitle>Sign in from your invitation</CardTitle>
            <CardDescription>
              Open the secure invitation link you were sent to continue. This is not the operator
              sign-in for Provvy.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>No participant workspaces</CardTitle>
            <CardDescription>
              {signedInEmail
                ? `You are signed in as ${signedInEmail}. This account is not invited to a participant workspace.`
                : 'This account is not invited to a participant workspace.'}{' '}
              Open the invitation you were sent, or log out if you meant to use a different email.
            </CardDescription>
          </CardHeader>
          <div className="px-6">
            <ParticipantLogoutButton onSignedOut={() => void handleSignOut()} />
          </div>
        </Card>
      </div>
    );
  }

  if (workspaces.length === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Opening your participant workspace…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center text-sm font-bold shrink-0">
              P
            </div>
            <span className="font-semibold tracking-tight">Provvypay</span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            {signedInEmail ? (
              <p className="text-xs text-muted-foreground truncate hidden sm:block">{signedInEmail}</p>
            ) : null}
            <ParticipantLogoutButton onSignedOut={() => void handleSignOut()} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Participant workspaces
          </p>
          <h1 className="text-2xl font-semibold mt-1">You have multiple participant workspaces</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose the commercial workspace you want to continue with.
          </p>
        </div>
        <ul className="space-y-3">
          {workspaces.map((workspace) => (
            <li key={workspace.portalToken}>
              <Card className="py-5">
                <CardHeader className="px-5">
                  <CardTitle className="text-lg">{workspace.projectName}</CardTitle>
                  <CardDescription>{workspace.operatorName}</CardDescription>
                </CardHeader>
                <div className="px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                      {workspace.statusLabel}
                    </p>
                    <p className="text-sm mt-1">
                      <span className="font-medium">Next required action: </span>
                      {workspace.nextRequiredAction}
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={workspace.path}>Continue</Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
