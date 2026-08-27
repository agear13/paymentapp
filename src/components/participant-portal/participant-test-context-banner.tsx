'use client';

import * as React from 'react';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { PARTICIPANT_TEST_CONTEXT_DEVELOPER_PATH } from '@/lib/participant-portal/participant-test-context';

type Props = {
  signedInEmail?: string | null;
};

export function ParticipantTestContextBanner({ signedInEmail }: Props) {
  const [busy, setBusy] = React.useState(false);

  const exit = React.useCallback(async () => {
    setBusy(true);
    try {
      await csrfAwareFetch('/api/internal/participant-test-context', { method: 'DELETE' });
    } finally {
      window.location.assign(PARTICIPANT_TEST_CONTEXT_DEVELOPER_PATH);
    }
  }, []);

  return (
    <div
      data-testid="participant-test-context-banner"
      className="border-b bg-amber-50 text-amber-950"
    >
      <div className="mx-auto max-w-4xl px-4 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide uppercase">Test participant mode</p>
          <p className="text-sm">
            You are exercising the participant portal using a temporary internal test identity.
            {signedInEmail ? ` Signed in as ${signedInEmail}.` : ''}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-sm font-medium underline underline-offset-2"
          onClick={() => void exit()}
          disabled={busy}
        >
          {busy ? 'Exiting…' : 'Exit test identity'}
        </button>
      </div>
    </div>
  );
}
