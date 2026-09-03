'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSafeInternalRedirectPath, isSafeParticipantReturnPath } from '@/lib/participant-portal/participant-auth-return';

function resolveNextPath(raw: string | null): string | null {
  if (isSafeParticipantReturnPath(raw) || isSafeInternalRedirectPath(raw)) return raw;
  return null;
}

function AuthCallbackCompleteInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState('Completing sign-in…');

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const next = resolveNextPath(searchParams.get('next'));
      const errorParam = searchParams.get('error');
      const code = searchParams.get('code');
      const supabase = createClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn('[auth-callback-complete] exchangeCodeForSession failed', error.message);
        }
      } else {
        await supabase.auth.getSession();
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data.session?.user) {
        if (next) {
          window.location.replace(next);
          return;
        }
        setStatus('Signed in. Return to your invitation link.');
        return;
      }

      if (errorParam === 'exchange_failed') {
        setStatus(
          'Sign-in did not complete. The magic-link code could not be exchanged. Request a new secure sign-in link.'
        );
        return;
      }

      if (errorParam === 'callback_failed') {
        setStatus(
          'Sign-in completed but Provvy could not finish routing your account. Try opening your workspace again or sign in from the login page.'
        );
        return;
      }

      setStatus(
        'Sign-in did not complete. This page never received an auth code. Open the newest sign-in email (not the original Review agreement invitation) in this browser.'
      );
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <p className="text-sm text-muted-foreground" data-testid="auth-callback-complete">
        {status}
      </p>
    </div>
  );
}

export default function AuthCallbackCompletePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">Completing sign-in…</p>
        </div>
      }
    >
      <AuthCallbackCompleteInner />
    </React.Suspense>
  );
}
