'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { ProvvypayPrivacyLink } from '@/components/legal/provvypay-legal-links';
import { TurnstileWidget } from '@/components/auth/turnstile-widget';
import { JARVIS_GA_EVENTS, trackGaEvent } from '@/lib/analytics/track-ga-event';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export function JarvisWaitlistForm({
  id = 'waitlist',
  submitLabel = 'Join the Jarvis waitlist',
}: {
  id?: string;
  submitLabel?: string;
}) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/auth/turnstile-config?scope=signup')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.enabled || !data.siteKey) return;
        setTurnstileRequired(true);
        setTurnstileSiteKey(data.siteKey);
      })
      .catch(() => undefined);
  }, []);

  const handleEmailStarted = () => {
    if (started) return;
    setStarted(true);
    trackGaEvent(JARVIS_GA_EVENTS.waitlistStarted);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!consent) {
      setStatus('error');
      setMessage('Please agree to the Privacy Policy and being contacted about Jarvis.');
      return;
    }
    if (turnstileRequired && !turnstileToken) {
      setStatus('error');
      setMessage('Security verification failed. Please try again.');
      return;
    }

    setStatus('submitting');
    setMessage(null);
    trackGaEvent(JARVIS_GA_EVENTS.waitlistSubmitted);

    try {
      const response = await fetch('/api/jarvis/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          consent: true,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        turnstileRequired?: boolean;
      };

      if (!response.ok) {
        setStatus('error');
        setMessage(payload.error ?? 'Enter a valid email address.');
        if (payload.turnstileRequired) setTurnstileRequired(true);
        return;
      }

      setStatus('success');
      setMessage(payload.message ?? "You're on the Jarvis waitlist. We'll be in touch.");
      setEmail('');
      setConsent(false);
      trackGaEvent(JARVIS_GA_EVENTS.waitlistSuccess);
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div
        id={id}
        className="rounded-2xl border border-primary/25 bg-accent/40 p-5 sm:p-6"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-[15px] font-semibold">You're on the list</p>
            <p className="mt-1 text-[13.5px] text-ink-soft">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status === 'error') {
              setStatus('idle');
              setMessage(null);
            }
          }}
          onFocus={handleEmailStarted}
          aria-invalid={status === 'error'}
          aria-describedby={message ? `${id}-feedback` : undefined}
          placeholder="you@company.com"
          className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-[15px] text-foreground shadow-soft outline-none ring-primary/30 placeholder:text-ink-soft focus:ring-2 sm:flex-1"
        />
        <button
          type="submit"
          disabled={status === 'submitting' || (turnstileRequired && !turnstileToken)}
          className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === 'submitting' ? 'Joining…' : submitLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
      <div className="flex items-start gap-2.5">
        <input
          id={`${id}-consent`}
          name="consent"
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
        />
        <label htmlFor={`${id}-consent`} className="text-[12px] leading-relaxed text-ink-soft">
          I agree to Provvy&apos;s{' '}
          <ProvvypayPrivacyLink className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </ProvvypayPrivacyLink>{' '}
          and to being contacted about the Jarvis early-access program.
        </label>
      </div>
      {turnstileRequired && turnstileSiteKey ? (
        <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
      ) : null}
      {message ? (
        <p id={`${id}-feedback`} className="text-[13px] text-red-600" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
