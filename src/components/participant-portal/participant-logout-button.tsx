'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOutClient } from '@/lib/auth/sign-out.client';
import { Button } from '@/components/ui/button';

export function ParticipantLogoutButton({
  onSignedOut,
}: {
  onSignedOut?: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const signOut = async () => {
    setBusy(true);
    const supabase = createClient();
    await signOutClient({ supabase, confirm: false });
    onSignedOut?.();
    setBusy(false);
  };

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()} disabled={busy}>
      Log out
    </Button>
  );
}
