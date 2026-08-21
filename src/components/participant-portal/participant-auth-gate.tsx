'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';

export type ParticipantInvitationPreview = {
  projectName: string;
  hostLabel: string;
  invitedEmail: string | null;
};

export function ParticipantAuthGate({
  token,
  invitation,
}: {
  token: string;
  invitation: ParticipantInvitationPreview;
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
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">
              Continue as <span className="font-medium">{invitation.invitedEmail}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This invitation does not have an email address. Contact the organiser.
            </p>
          )}
          {sent ? (
            <p className="text-sm text-foreground">
              A secure sign-in link has been sent. Open it from the invited email inbox to continue.
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
  onSignOut,
}: {
  signedInEmail?: string | null;
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
        <div className="px-6 pb-6">
          <Button type="button" variant="outline" onClick={onSignOut}>
            Log out
          </Button>
        </div>
      </Card>
    </div>
  );
}
