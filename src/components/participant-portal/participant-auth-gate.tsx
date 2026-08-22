'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { CsrfBootstrap } from '@/components/security/csrf-bootstrap';

export type ParticipantInvitationPreview = {
  projectName: string;
  hostLabel: string;
  invitedEmail: string | null;
};

export function ParticipantAuthGate({
  token,
  invitation,
  recoveredFromWrongAccount = false,
  signedOut = false,
}: {
  token: string;
  invitation: ParticipantInvitationPreview;
  recoveredFromWrongAccount?: boolean;
  signedOut?: boolean;
}) {
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sendLink = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await csrfAwareFetch(
        `/api/participant-portal/${encodeURIComponent(token)}/auth/send-link`,
        { method: 'POST', credentials: 'include' }
      );
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error || 'Could not send a sign-in link');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a sign-in link');
    } finally {
      setSending(false);
    }
  };

  const projectName = invitation.projectName.trim();
  const invitedEmail = invitation.invitedEmail?.trim() || null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <CsrfBootstrap />
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">{sent ? 'Check your email' : 'Sign in to continue'}</CardTitle>
          {sent ? (
            <CardDescription>
              We&apos;ve sent a secure sign-in link to {invitedEmail || 'the invited email'}.
              Open the most recent email from Provvypay to continue.
            </CardDescription>
          ) : (
            <CardDescription>
              {projectName ? `Sign in to ${projectName}` : 'Sign in to your participant workspace'}.
            </CardDescription>
          )}
        </CardHeader>
        <div className="space-y-4 px-6 pb-6">
          {signedOut && !sent ? (
            <p className="text-sm text-foreground" data-testid="participant-signed-out">
              You&apos;ve been signed out.
              {projectName ? ` Sign in again to continue to ${projectName}.` : ' Sign in again to continue.'}
            </p>
          ) : null}
          {recoveredFromWrongAccount && !sent ? (
            <p className="text-sm text-foreground">
              You signed out of the previous account. We&apos;ll send a secure sign-in link to the
              invited email below.
            </p>
          ) : null}
          {!sent && invitedEmail ? (
            <div
              className="rounded-lg bg-muted px-3 py-3 space-y-1"
              data-invitation-gate="sign-in-to-continue"
            >
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                We&apos;ll send a secure sign-in link to
              </p>
              <p className="text-sm font-medium" data-testid="invited-participant-email">
                {invitedEmail}
              </p>
            </div>
          ) : null}
          {!sent && !invitedEmail ? (
            <p className="text-sm text-muted-foreground">
              This invitation does not have an email address. Contact the organiser.
            </p>
          ) : null}
          <Button
            type="button"
            onClick={() => void sendLink()}
            disabled={sending || !invitedEmail}
          >
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {sent ? 'Send another link' : 'Send secure sign-in link'}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </Card>
    </div>
  );
}

export function ParticipantAccessDenied({
  signedInEmail,
  onSignInWithInvitedAccount,
  onSignOut,
}: {
  signedInEmail?: string | null;
  onSignInWithInvitedAccount: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>This account does not have access</CardTitle>
          <CardDescription>
            {signedInEmail
              ? `You are signed in as ${signedInEmail}. This participant workspace belongs to a different invited identity.`
              : 'This participant workspace belongs to a different invited identity.'}
          </CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-2 px-6 pb-6">
          <Button type="button" onClick={onSignInWithInvitedAccount}>
            Sign in with the invited account
          </Button>
          <Button type="button" variant="outline" onClick={onSignOut}>
            Log out
          </Button>
        </div>
      </Card>
    </div>
  );
}
