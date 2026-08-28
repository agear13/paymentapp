'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CsrfBootstrap } from '@/components/security/csrf-bootstrap';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { CSRF_PREPARING_LABEL, useClientCsrfReady } from '@/hooks/use-client-csrf-ready';
import {
  postLoginDestination,
  resolvePostLoginDestination,
} from '@/lib/journey/commercial-os-routes';
import { MFA_ENROLL_PATH, MFA_STEP_UP_MESSAGES, type MfaStepUpCode } from '@/lib/auth/mfa-assurance';

type Factor = { id: string; status: string; friendlyName: string | null };

function isSafeNext(value: string | null): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'));
}

export function MfaChallengeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, isPreparing } = useClientCsrfReady();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reason = searchParams.get('reason') as MfaStepUpCode | null;
  const next = searchParams.get('next');

  const verifiedFactor = useMemo(
    () => factors.find((factor) => factor.status === 'verified') ?? factors[0],
    [factors]
  );

  useEffect(() => {
    void csrfAwareFetch('/api/security/mfa/status')
      .then((response) => response.json())
      .then((data) => {
        if (data?.factors) {
          setFactors(data.factors);
        }
        if (data?.enrolled === false) {
          setStatusMessage(MFA_STEP_UP_MESSAGES.MFA_ENROLLMENT_REQUIRED);
        }
      })
      .catch(() => undefined);
  }, []);

  const continueAfterSuccess = () => {
    if (isSafeNext(next) && next.startsWith('/api/')) {
      window.location.href = next;
      return;
    }
    router.replace(isSafeNext(next) ? resolvePostLoginDestination(next) : postLoginDestination());
    router.refresh();
  };

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (!verifiedFactor) {
      setError('No authenticator is enrolled on this account.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const challengeResponse = await csrfAwareFetch('/api/security/mfa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: verifiedFactor.id }),
      });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok) {
        throw new Error(challenge.error || 'Could not start authenticator challenge.');
      }

      const verifyResponse = await csrfAwareFetch('/api/security/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factorId: verifiedFactor.id,
          challengeId: challenge.challengeId,
          code,
          purpose: reason === 'STEP_UP_REQUIRED' ? 'step-up' : 'challenge',
        }),
      });
      const verified = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verified.error || 'Invalid authenticator code.');
      }
      continueAfterSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not verify authenticator code.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await csrfAwareFetch('/api/security/mfa/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: recoveryCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Invalid recovery code.');
      }
      router.replace('/auth/login');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not use recovery code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <CsrfBootstrap />
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Two-factor authentication</h1>
          <p className="text-sm text-muted-foreground">
            {reason && MFA_STEP_UP_MESSAGES[reason]
              ? MFA_STEP_UP_MESSAGES[reason]
              : 'Enter the 6-digit code from your authenticator app to continue.'}
          </p>
        </div>

        {statusMessage ? (
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>{statusMessage}</p>
            <Button type="button" className="w-full" onClick={() => router.replace(MFA_ENROLL_PATH)}>
              Set up authenticator
            </Button>
          </div>
        ) : null}

        {!showRecovery ? (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totp-code">Authenticator code</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                disabled={loading || isPreparing}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !isReady}>
              {isPreparing ? CSRF_PREPARING_LABEL : loading ? 'Verifying...' : 'Continue'}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowRecovery(true)}
            >
              Use a recovery code
            </button>
          </form>
        ) : (
          <form onSubmit={handleRecovery} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-code">Recovery code</Label>
              <Input
                id="recovery-code"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                placeholder="XXXX-XXXX"
                disabled={loading || isPreparing}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !isReady}>
              {loading ? 'Checking recovery code...' : 'Disable authenticator and continue'}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowRecovery(false)}
            >
              Back to authenticator code
            </button>
          </form>
        )}

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
