'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SIGNUP_CHECK_EMAIL_BODY,
  SIGNUP_CHECK_EMAIL_MISSING_HINT,
  SIGNUP_CHECK_EMAIL_TITLE,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from '@/lib/auth/email-verification';
import { opSurfaceCritical, opToneDanger } from '@/lib/design/operational-surfaces';
import { cn } from '@/lib/utils';

type SignupCheckEmailProps = {
  email: string;
  variant?: 'auth' | 'journey';
  initialCooldownSeconds?: number;
  onUseDifferentEmail?: () => void;
};

export function SignupCheckEmail({
  email,
  variant = 'auth',
  initialCooldownSeconds = VERIFICATION_RESEND_COOLDOWN_SECONDS,
  onUseDifferentEmail,
}: SignupCheckEmailProps) {
  const [cooldown, setCooldown] = useState(Math.max(0, initialCooldownSeconds));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const journey = variant === 'journey';

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
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        retryAfterSeconds?: number;
        message?: string;
      };

      if (data.retryAfterSeconds) {
        setCooldown(data.retryAfterSeconds);
      }

      if (!response.ok) {
        if (response.status === 429) {
          setError(
            data.error ||
              `You can request another verification email in ${data.retryAfterSeconds ?? cooldown} seconds.`
          );
          return;
        }
        throw new Error(data.error || 'Could not resend verification email');
      }

      setMessage('Verification email sent. Please check your inbox.');
      setCooldown(data.retryAfterSeconds ?? VERIFICATION_RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend verification email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="signup-check-email">
      <div className={journey ? 'flex items-start gap-3' : 'space-y-3'}>
        {journey ? (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" aria-hidden />
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(124,92,255,0.12)] text-primary">
            <Mail className="h-5 w-5" aria-hidden />
          </div>
        )}
        <div className="space-y-2 min-w-0">
          <h2
            className={
              journey
                ? 'text-[22px] font-semibold tracking-[-0.03em] text-foreground'
                : 'text-3xl font-semibold tracking-tight'
            }
          >
            {SIGNUP_CHECK_EMAIL_TITLE}
          </h2>
          <p
            className={
              journey
                ? 'text-[13.5px] leading-relaxed text-ink-soft'
                : 'text-muted-foreground leading-relaxed'
            }
          >
            {SIGNUP_CHECK_EMAIL_BODY}
          </p>
          {email ? (
            <p
              className={
                journey ? 'text-[13px] font-medium text-foreground break-all' : 'text-sm font-medium break-all'
              }
            >
              {email}
            </p>
          ) : null}
        </div>
      </div>

      <p
        className={
          journey ? 'text-[13px] leading-relaxed text-ink-soft' : 'text-sm text-muted-foreground leading-relaxed'
        }
      >
        <span className="font-semibold text-foreground">Can&apos;t find it?</span>{' '}
        {SIGNUP_CHECK_EMAIL_MISSING_HINT}
      </p>

      {message ? (
        <div
          className={
            journey
              ? 'rounded-xl border border-primary/20 bg-accent px-3 py-2.5 text-[13px] text-foreground'
              : 'surface-settlement px-4 py-3 rounded-lg text-sm'
          }
          role="status"
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          className={cn(
            opSurfaceCritical,
            opToneDanger,
            journey ? 'rounded-xl px-3 py-2.5 text-[13px]' : 'px-4 py-3 text-sm'
          )}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {journey ? (
          <button
            type="button"
            disabled={loading || cooldown > 0}
            onClick={() => void handleResend()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {cooldown > 0
              ? `Resend available in ${cooldown}s`
              : loading
                ? 'Sending…'
                : 'Resend verification email'}
          </button>
        ) : (
          <Button
            type="button"
            className="w-full h-11 text-base"
            disabled={loading || cooldown > 0}
            onClick={() => void handleResend()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {cooldown > 0
              ? `Resend available in ${cooldown}s`
              : loading
                ? 'Sending...'
                : 'Resend verification email'}
          </Button>
        )}

        {onUseDifferentEmail ? (
          journey ? (
            <button
              type="button"
              disabled={loading}
              onClick={onUseDifferentEmail}
              className="w-full text-center text-[12px] font-medium text-primary hover:underline disabled:opacity-60"
            >
              Use a different email
            </button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={loading}
              onClick={onUseDifferentEmail}
            >
              Use a different email
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}
