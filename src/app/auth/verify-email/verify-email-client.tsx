'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProvvypayLogoMark } from '@/components/provvypay/provvypay-logo-mark';
import { emitAuthAuditEvent } from '@/lib/security/auth-audit.client';

export function VerifyEmailClient({ email }: { email: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCooldown = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/resend-verification');
      if (response.ok) {
        const data = await response.json();
        setCooldown(data.cooldownRemaining ?? 0);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshCooldown();
  }, [refreshCooldown]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.retryAfterSeconds) {
          setCooldown(data.retryAfterSeconds);
        }
        throw new Error(data.error || 'Could not resend verification email');
      }
      setMessage('Verification email sent. Please check your inbox.');
      setCooldown(data.retryAfterSeconds ?? 60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not update email');
      }
      setMessage(data.message ?? 'Email updated. Please verify the new address.');
      setChangingEmail(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update email');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    void emitAuthAuditEvent({ eventType: 'auth.logout', email });
    await supabase.auth.signOut();
    router.replace('/auth/login');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[rgba(124,92,255,0.03)] to-background p-6">
      <div className="surface-elevated w-full max-w-md space-y-6 p-8">
        <div className="flex justify-center">
          <ProvvypayLogoMark size="md" />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Verify your email</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please verify your email address before continuing.
          </p>
          <p className="text-sm font-medium">{email}</p>
        </div>

        {message && (
          <div className="surface-settlement rounded-lg px-4 py-3 text-sm">{message}</div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Button
            type="button"
            className="w-full"
            disabled={loading || cooldown > 0}
            onClick={handleResend}
          >
            {cooldown > 0
              ? `You can request another verification email in ${cooldown}s`
              : loading
                ? 'Sending...'
                : 'Resend verification email'}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => setChangingEmail((value) => !value)}
          >
            Change email
          </Button>

          <Button type="button" variant="ghost" className="w-full" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        {changingEmail && (
          <form onSubmit={handleChangeEmail} className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">New email address</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              Update email
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
