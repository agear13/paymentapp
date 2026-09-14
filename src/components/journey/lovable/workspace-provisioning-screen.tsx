'use client';

import '@/components/journey/lovable/lovable-journey.css';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { ProvvyOrb } from '@/components/jarvis/provvy-orb';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { createClient } from '@/lib/supabase/client';
import { completeJourneyOnboarding } from '@/lib/journey/complete-journey-onboarding.client';
import { consumePostProvisioningDestination } from '@/lib/journey/journey-invoice-activation.client';
import {
  fetchAuthorizedParticipantWorkspacePrefill,
  shouldOfferParticipantWorkspaceNameConfirm,
} from '@/lib/journey/journey-participant-prefill.client';
import { restoreJourneyAssessment } from '@/lib/journey/journey-assessment-storage.client';

const STEPS = [
  'Creating your workspace',
  'Setting up your Professional trial',
  'Saving your workspace preferences',
  'Preparing your Workspace',
];

export function WorkspaceProvisioningScreen() {
  const router = useRouter();
  const supabase = createClient();
  const bootstrapStartedRef = useRef(false);

  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = step >= STEPS.length && ready;
  const progress = Math.min(100, (step / STEPS.length) * 100);

  useEffect(() => {
    restoreJourneyAssessment();
  }, []);

  useEffect(() => {
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;

    let cancelled = false;

    async function bootstrapAndEnterWorkspace() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace(COMMERCIAL_OS_ROUTES.provisioning);
          return;
        }

        let hasOrganization = false;
        try {
          const existing = await fetch('/api/onboarding', {
            credentials: 'include',
            cache: 'no-store',
          });
          if (existing.ok) {
            const payload = (await existing.json()) as { hasOrganization?: boolean };
            hasOrganization = Boolean(payload.hasOrganization);
          }
        } catch {
          /* continue; bootstrap remains authoritative */
        }

        if (!hasOrganization) {
          try {
            const prefill = await fetchAuthorizedParticipantWorkspacePrefill();
            if (shouldOfferParticipantWorkspaceNameConfirm(hasOrganization, prefill)) {
              router.replace(COMMERCIAL_OS_ROUTES.provisioning);
              return;
            }
          } catch {
            /* prefill failure must not block workspace creation */
          }
        }

        await completeJourneyOnboarding(data.session.user.email ?? undefined);
        if (cancelled) return;

        setReady(true);
        setStep(STEPS.length);
        const next = consumePostProvisioningDestination();
        router.replace(next ?? COMMERCIAL_OS_ROUTES.workspace);
        router.refresh();
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to set up workspace';
        setError(message);
      }
    }

    void bootstrapAndEnterWorkspace();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done || error) return;
    const t = setTimeout(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 950);
    return () => clearTimeout(t);
  }, [step, done, error]);

  return (
    <section className="relative flex min-h-[calc(100vh-160px)] items-center px-6 py-16 animate-fade-up">
      <div className="mx-auto w-full max-w-3xl text-center">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          {done ? (
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-purple text-primary-foreground shadow-glow">
              <Check className="h-7 w-7" />
            </div>
          ) : (
            <ProvvyOrb
              state={error ? 'idle' : 'thinking'}
              size="sm"
              className="landing-advisor-orb mx-auto"
            />
          )}
        </div>

        <h1 className="mt-8 text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl md:text-5xl">
          {error
            ? 'Setup needs another try'
            : done
              ? 'Your workspace is ready'
              : 'Building your Provvy workspace…'}
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          {error
            ? error
            : done
              ? 'Opening your workspace…'
              : "I'm using what you told me to set up the tools and recommendations most relevant to your business."}
        </p>

        <div className="mx-auto mt-10 max-w-md">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${done ? 100 : progress}%` }}
            />
          </div>
          <div className="mt-2 text-[12px] text-ink-soft">
            {done ? '100% complete' : `${Math.round(progress)}% complete`}
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-2xl gap-2 text-left">
          {STEPS.map((label, i) => {
            const isDone = i < step || done;
            const active = i === step && !done && !error;
            return (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[13.5px] transition-all ${
                  isDone
                    ? 'border-primary/30 bg-accent text-foreground'
                    : active
                      ? 'border-border bg-card text-foreground shadow-card'
                      : 'border-border bg-card text-ink-soft opacity-60'
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-border" />
                )}
                <span className="font-medium">{label}</span>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-md text-[13px] text-ink-soft">
          Check plan, trial status and upgrades anytime in Settings → Plan &amp; Billing.
        </p>

        {error ? (
          <button
            type="button"
            onClick={() => router.replace(COMMERCIAL_OS_ROUTES.provisioning)}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
          >
            Back to workspace setup
          </button>
        ) : null}
      </div>
    </section>
  );
}
