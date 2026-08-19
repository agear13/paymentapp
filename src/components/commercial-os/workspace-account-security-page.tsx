'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { LastLoginSection } from '@/components/dashboard/settings/last-login-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { CSRF_PREPARING_LABEL, useClientCsrfReady } from '@/hooks/use-client-csrf-ready';
import { MIN_PASSWORD_LENGTH, validatePassword } from '@/lib/auth/password-policy';

type MfaStatus = {
  enrolled: boolean;
  ownerMfaRequired: boolean;
  challengeRequired: boolean;
  unusedRecoveryCodeCount: number;
  factors: Array<{ id: string; status: string; friendlyName: string | null }>;
};

export function WorkspaceAccountSecurityPage() {
  const { isReady, isPreparing } = useClientCsrfReady();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollQr, setEnrollQr] = useState<string | null>(null);
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshStatus = async () => {
    const response = await csrfAwareFetch('/api/security/mfa/status');
    const data = await response.json();
    if (response.ok) {
      setStatus({
        enrolled: Boolean(data.enrolled),
        ownerMfaRequired: Boolean(data.ownerMfaRequired),
        challengeRequired: Boolean(data.challengeRequired),
        unusedRecoveryCodeCount: data.unusedRecoveryCodeCount ?? 0,
        factors: data.factors ?? [],
      });
    }
  };

  useEffect(() => {
    void refreshStatus().catch(() => undefined);
  }, []);

  const setAlert = (nextError: string | null, nextMessage: string | null) => {
    setError(nextError);
    setMessage(nextMessage);
  };

  const handleEnroll = async () => {
    setLoading(true);
    setAlert(null, null);
    try {
      const response = await csrfAwareFetch('/api/security/mfa/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendlyName: 'Authenticator' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not start authenticator enrollment.');
      }
      setEnrollFactorId(data.factorId);
      setEnrollQr(data.totp?.qrCode ?? null);
      setEnrollSecret(data.totp?.secret ?? null);
    } catch (err: unknown) {
      setAlert(err instanceof Error ? err.message : 'Could not start enrollment.', null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmEnroll = async (event: FormEvent) => {
    event.preventDefault();
    if (!enrollFactorId) return;
    setLoading(true);
    setAlert(null, null);
    try {
      const challengeResponse = await csrfAwareFetch('/api/security/mfa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: enrollFactorId }),
      });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok) {
        throw new Error(challenge.error || 'Could not start authenticator challenge.');
      }
      const verifyResponse = await csrfAwareFetch('/api/security/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factorId: enrollFactorId,
          challengeId: challenge.challengeId,
          code: totpCode,
          purpose: 'enrollment',
        }),
      });
      const verified = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verified.error || 'Invalid authenticator code.');
      }
      setRecoveryCodes(verified.recoveryCodes ?? null);
      setEnrollFactorId(null);
      setEnrollQr(null);
      setEnrollSecret(null);
      setTotpCode('');
      await refreshStatus();
      setAlert(null, 'Two-factor authentication is on. Store your recovery codes now.');
    } catch (err: unknown) {
      setAlert(err instanceof Error ? err.message : 'Could not confirm enrollment.', null);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    const factorId = status?.factors.find((factor) => factor.status === 'verified')?.id;
    if (!factorId) return;
    setLoading(true);
    setAlert(null, null);
    try {
      const response = await csrfAwareFetch('/api/security/mfa/unenroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not disable two-factor authentication.');
      }
      setRecoveryCodes(null);
      await refreshStatus();
      setAlert(null, 'Two-factor authentication was turned off.');
    } catch (err: unknown) {
      setAlert(err instanceof Error ? err.message : 'Could not disable two-factor authentication.', null);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setAlert(null, null);
    try {
      const response = await csrfAwareFetch('/api/security/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not change email.');
      }
      setNewEmail('');
      setAlert(null, data.message ?? 'Check the new inbox to confirm this email change.');
    } catch (err: unknown) {
      setAlert(err instanceof Error ? err.message : 'Could not change email.', null);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setAlert('Passwords do not match.', null);
      return;
    }
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      setAlert(passwordCheck.message, null);
      return;
    }
    setLoading(true);
    setAlert(null, null);
    try {
      const response = await csrfAwareFetch('/api/security/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not change password.');
      }
      setNewPassword('');
      setConfirmPassword('');
      setAlert(null, data.message ?? 'Password updated.');
    } catch (err: unknown) {
      setAlert(err instanceof Error ? err.message : 'Could not change password.', null);
    } finally {
      setLoading(false);
    }
  };

  const verifiedFactor = status?.factors.find((factor) => factor.status === 'verified');

  return (
    <div className="animate-fade-up space-y-6 pb-16">
      <header>
        <Link href={COMMERCIAL_OS_ROUTES.settings} className="text-[13px] text-ink-soft hover:text-foreground">
          ← Workspace Settings
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Sign-in &amp; Security</h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Sessions, authenticator protection, and high-risk account changes.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-8">
        <div>
          <h2 className="text-[15px] font-semibold">Recent sign-in</h2>
          <div className="mt-3">
            <LastLoginSection />
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-4">
          <div>
            <h2 className="text-[15px] font-semibold">Two-factor authentication</h2>
            <p className="mt-2 text-[13px] text-ink-soft">
              Authenticator app (TOTP) is required before payment destinations, Xero, or recovery details can change.
            </p>
          </div>

          {status?.ownerMfaRequired && !status.enrolled ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              Owner accounts must enroll an authenticator before changing payment configuration.
            </p>
          ) : null}

          {status?.enrolled ? (
            <p className="text-[13px] text-ink-soft">
              Authenticator is on
              {verifiedFactor?.friendlyName ? ` (${verifiedFactor.friendlyName})` : ''}.
              {status.unusedRecoveryCodeCount
                ? ` ${status.unusedRecoveryCodeCount} unused recovery codes remain.`
                : ''}
            </p>
          ) : (
            <p className="text-[13px] text-ink-soft">Authenticator is not enabled yet.</p>
          )}

          {enrollQr ? (
            <form onSubmit={handleConfirmEnroll} className="space-y-3">
              {enrollQr.includes('<svg') ? (
                <div
                  className="mx-auto w-48"
                  dangerouslySetInnerHTML={{ __html: enrollQr }}
                />
              ) : (
                // QR payload is a data URL from Supabase Auth, not a static asset.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={enrollQr} alt="Authenticator QR code" className="mx-auto h-48 w-48" />
              )}
              {enrollSecret ? (
                <p className="text-center text-[12px] text-ink-soft">
                  Secret: <span className="font-mono">{enrollSecret}</span>
                </p>
              ) : null}
              <Label htmlFor="enroll-code">Enter the 6-digit code</Label>
              <Input
                id="enroll-code"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
                placeholder="123456"
                required
              />
              <Button type="submit" disabled={loading || !isReady}>
                {isPreparing ? CSRF_PREPARING_LABEL : 'Confirm authenticator'}
              </Button>
            </form>
          ) : null}

          {recoveryCodes?.length ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-[13px] font-medium">Save these recovery codes now. They will not be shown again.</p>
              <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-[12px]">
                {recoveryCodes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!status?.enrolled && !enrollQr ? (
              <Button type="button" onClick={() => void handleEnroll()} disabled={loading || !isReady}>
                Enroll authenticator
              </Button>
            ) : null}
            {status?.enrolled ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDisable()}
                disabled={loading || !isReady}
              >
                Turn off two-factor authentication
              </Button>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleChangeEmail} className="rounded-xl border p-4 space-y-3">
          <h2 className="text-[15px] font-semibold">Change email</h2>
          <p className="text-[13px] text-ink-soft">
            Requires a recent authenticator confirmation. We will notify your current email address.
          </p>
          <Label htmlFor="new-email">New email</Label>
          <Input
            id="new-email"
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            required
          />
          <Button type="submit" disabled={loading || !isReady}>
            Request email change
          </Button>
        </form>

        <form onSubmit={handleChangePassword} className="rounded-xl border p-4 space-y-3">
          <h2 className="text-[15px] font-semibold">Change password</h2>
          <p className="text-[13px] text-ink-soft">
            Requires a recent authenticator confirmation. Other sessions will be signed out.
          </p>
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <p className="text-[12px] text-ink-soft">At least {MIN_PASSWORD_LENGTH} characters.</p>
          <Label htmlFor="confirm-new-password">Confirm new password</Label>
          <Input
            id="confirm-new-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <Button type="submit" disabled={loading || !isReady}>
            Update password
          </Button>
        </form>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
