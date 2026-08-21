'use client';

import * as React from 'react';
import {
  reloadParticipantInvitation,
  signOutParticipantSession,
} from '@/lib/participant-portal/participant-sign-out.client';
import { Button } from '@/components/ui/button';

export function ParticipantLogoutButton({
  token,
  recoveredFromWrongAccount = false,
  onSignedOut,
}: {
  token?: string;
  recoveredFromWrongAccount?: boolean;
  onSignedOut?: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const signOut = async () => {
    setBusy(true);
    await signOutParticipantSession();
    if (token) {
      reloadParticipantInvitation(token, recoveredFromWrongAccount);
      return;
    }
    onSignedOut?.();
    setBusy(false);
  };

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()} disabled={busy}>
      Log out
    </Button>
  );
}
