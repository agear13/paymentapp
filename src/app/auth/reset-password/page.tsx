'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { emitAuthAuditEvent } from '@/lib/security/auth-audit.client';
import { TurnstileWidget } from '@/components/auth/turnstile-widget';
import { MIN_PASSWORD_LENGTH, validatePassword } from '@/lib/auth/password-policy';
import { GENERIC_RESET_RESPONSE } from '@/lib/auth/auth-errors';

export default function ResetPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [readyToSetPassword, setReadyToSetPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecoveryLink, setIsRecoveryLink] = useState(false);
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const token = params.get('token_hash');
    setIsRecoveryLink(type === 'recovery');
    setTokenHash(token);
  }, []);

  useEffect(() => {
    void fetch('/api/auth/turnstile-config?scope=reset')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setTurnstileRequired(Boolean(data.required));
        setTurnstileSiteKey(data.siteKey ?? null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isRecoveryLink || !tokenHash) return;

    async function bootstrapRecoverySession() {
      setVerifyingToken(true);
      setError(null);
      try {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
        if (verifyError) throw verifyError;
        setReadyToSetPassword(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Password reset link is invalid or expired.');
      } finally {
        setVerifyingToken(false);
      }
    }

    bootstrapRecoverySession();
  }, [isRecoveryLink, tokenHash, supabase]);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.turnstileRequired) setTurnstileRequired(true);
        throw new Error(data.error || 'Could not send reset email.');
      }
      void emitAuthAuditEvent({
        eventType: 'auth.password.reset.requested',
        email,
      });
      setMessage(data.message ?? GENERIC_RESET_RESPONSE);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message);
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      void emitAuthAuditEvent({
        eventType: 'auth.password.reset.completed',
        email,
      });
      setMessage('Password updated successfully. You can now sign in.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  const showSetPasswordForm = readyToSetPassword || (isRecoveryLink && !tokenHash);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-sm text-muted-foreground">
            {showSetPasswordForm
              ? 'Choose a new password for your account.'
              : 'Enter your email and we will send you a reset link.'}
          </p>
        </div>

        {verifyingToken ? (
          <p className="text-sm text-muted-foreground">Verifying reset link...</p>
        ) : showSetPasswordForm ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be at least {MIN_PASSWORD_LENGTH} characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Updating password...' : 'Update password'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSendReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={loading}
                required
              />
            </div>
            {turnstileRequired && turnstileSiteKey ? (
              <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || (turnstileRequired && !turnstileToken)}
            >
              {loading ? 'Sending reset link...' : 'Send reset link'}
            </Button>
          </form>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
