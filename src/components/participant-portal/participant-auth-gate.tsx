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
}: {
  token: string;
  invitation: ParticipantInvitationPreview;
  recoveredFromWrongAccount?: boolean;
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <CsrfBootstrap />
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Referral Management invitation
          </p>
          <CardTitle className="text-xl">
            {invitation.hostLabel} has invited you to participate
            {invitation.projectName ? ` in ${invitation.projectName}` : ''}.
          </CardTitle>
          <CardDescription>
            Sign in with the invited email to continue to this agreement and workspace. Opening this
            link does not grant access by itself.
          </CardDescription>
        </CardHeader>
        <div className="space-y-4 px-6 pb-6">
          {invitation.invitedEmail ? (
            <div
              className="rounded-lg bg-muted px-3 py-3 space-y-1"
              data-invitation-gate="sign-in-to-continue"
            >
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sign in to continue
              </p>
              <p className="text-sm font-medium" data-testid="invited-participant-email">
                {invitation.invitedEmail}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This invitation does not have an email address. Contact the organiser.
            </p>
          )}
          {recoveredFromWrongAccount ? (
            <p className="text-sm text-foreground">
              You signed out of the previous account. We&apos;ll send a secure sign-in link to the
              invited email address above.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              We&apos;ll email a secure sign-in link to this address. You are not signed in yet.
              Open that newest sign-in email — not the original invitation that says Review
              agreement.
            </p>
          )}
          {sent ? (
            <p className="text-sm text-foreground">
              A secure sign-in link has been sent. Open the newest sign-in email in this browser.
              Do not use the original Review agreement invitation — that link is not a sign-in
              code.
            </p>
          ) : (
            <Button
              type="button"
              onClick={() => void sendLink()}
              disabled={sending || !invitation.invitedEmail}
            >
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send secure sign-in link
            </Button>
          )}
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
