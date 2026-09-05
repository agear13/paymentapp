'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { TurnstileWidget } from '@/components/auth/turnstile-widget';
import { useOptionalLandingAdvisor } from '@/components/journey/lovable/landing-advisor-context';
import { ProvvypayPrivacyLink } from '@/components/legal/provvypay-legal-links';
import { trackGaEvent } from '@/lib/analytics/track-ga-event';
import {
  PAYMENT_INTELLIGENCE_SUBSCRIBE_ANCHOR,
  presentPaymentIntelligenceSubscribe,
} from '@/lib/marketing/payment-intelligence-subscribe';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const PAYMENT_INTELLIGENCE_GA = {
  started: 'payment_intelligence_subscribe_started',
  submitted: 'payment_intelligence_subscribe_submitted',
  success: 'payment_intelligence_subscribe_success',
} as const;

export function LandingPaymentIntelligenceSubscribe() {
  const advisor = useOptionalLandingAdvisor();
  const compared = advisor?.context.stage === 'results' || advisor?.context.stage === 'detail';
  const origin = compared ? advisor?.context.origin : null;
  const destination = compared ? advisor?.context.destination : null;
  const copy = presentPaymentIntelligenceSubscribe({
    origin,
    destination,
    compared,
  });

  const [email, setEmail] = useState('');
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
    trackGaEvent(PAYMENT_INTELLIGENCE_GA.started);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (turnstileRequired && !turnstileToken) {
      setStatus('error');
      setMessage('Security verification failed. Please try again.');
      return;
    }

    setStatus('submitting');
    setMessage(null);
    trackGaEvent(PAYMENT_INTELLIGENCE_GA.submitted);

    try {
      const response = await fetch('/api/payment-intelligence/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          consent: true,
          origin: origin ?? undefined,
          destination: destination ?? undefined,
          compared: Boolean(compared && origin && destination),
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
        setMessage(payload.error ?? 'Enter a valid work email.');
        if (payload.turnstileRequired) setTurnstileRequired(true);
        return;
      }

      setStatus('success');
      setMessage(payload.message ?? "You're on the Payment Intelligence list.");
      setEmail('');
      trackGaEvent(PAYMENT_INTELLIGENCE_GA.success);
    } catch {
      setStatus('error');
      setMessage("We couldn't save that just now. Please try again.");
    }
  };

  return (
    <section
      id={PAYMENT_INTELLIGENCE_SUBSCRIBE_ANCHOR}
      aria-labelledby="payment-intelligence-inbox-heading"
      data-intelligence-subscribe="inbox"
      className="rounded-2xl border border-primary/20 bg-card/95 px-4 py-4 shadow-soft backdrop-blur-md sm:px-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {copy.eyebrow}
      </p>
      <h2
        id="payment-intelligence-inbox-heading"
        className="mt-1 text-balance text-[1.05rem] font-semibold tracking-[-0.02em] sm:text-lg"
      >
        {copy.heading}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-snug text-ink-soft">{copy.lead}</p>
      {copy.support ? (
        <p className="mt-1 max-w-2xl text-[13px] leading-snug text-ink-soft">{copy.support}</p>
      ) : null}

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {copy.topics.map((topic) => (
          <li key={topic.id} className="text-[12px] leading-snug text-ink-soft">
            <span className="font-medium text-foreground">{topic.title}</span>
            <span> — {topic.detail}</span>
          </li>
        ))}
      </ul>

      {status === 'success' ? (
        <p className="mt-4 text-[13px] font-medium text-foreground" role="status" aria-live="polite">
          {message}
        </p>
      ) : (
        <form className="mt-4 space-y-2" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="payment-intelligence-email" className="sr-only">
              Your work email
            </label>
            <input
              id="payment-intelligence-email"
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
              aria-describedby={message ? 'payment-intelligence-email-feedback' : undefined}
              placeholder="Your work email"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[13px] text-foreground outline-none ring-primary/20 placeholder:text-ink-soft focus-visible:border-primary/40 focus-visible:ring-2 sm:max-w-xs"
            />
            <button
              type="submit"
              disabled={status === 'submitting' || (turnstileRequired && !turnstileToken)}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-foreground px-3.5 text-[13px] font-medium text-background disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === 'submitting' ? 'Saving…' : 'Get Payment Intelligence →'}
            </button>
          </div>
          <p className="text-[11px] leading-snug text-ink-soft">
            By continuing you agree to Provvy&apos;s{' '}
            <ProvvypayPrivacyLink className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </ProvvypayPrivacyLink>
            .
          </p>
          {turnstileRequired && turnstileSiteKey ? (
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
          ) : null}
          {message ? (
            <p
              id="payment-intelligence-email-feedback"
              className="text-[12px] text-destructive"
              role="alert"
            >
              {message}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
