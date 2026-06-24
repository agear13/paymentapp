'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ProvvypayLogoMark } from '@/components/provvypay/provvypay-logo-mark';
import { emitAuthAuditEvent } from '@/lib/security/auth-audit.client';

export function ConfirmLoginClient({ reason }: { reason?: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setLoading(true);
    void emitAuthAuditEvent({ eventType: 'auth.logout' });
    await supabase.auth.signOut();
    router.replace('/auth/login');
  };

  const handleContinue = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/confirm-login', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Could not confirm sign-in');
      }
      router.replace('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not confirm sign-in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="surface-elevated w-full max-w-md space-y-6 p-8">
        <div className="flex justify-center">
          <ProvvypayLogoMark size="md" />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Confirm this sign-in</h1>
          <p className="text-sm text-muted-foreground">
            {reason ??
              'We detected a sign-in from an unusual location. Please confirm it was you to continue.'}
          </p>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <Button className="w-full" onClick={handleContinue} disabled={loading}>
          Yes, this was me
        </Button>
        <Button variant="outline" className="w-full" onClick={handleSignOut} disabled={loading}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
