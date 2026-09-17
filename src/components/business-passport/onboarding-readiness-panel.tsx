'use client';

import { useEffect, useState } from 'react';
import type { RailOnboardingReadiness } from '@/lib/business-passport/types';

export function OnboardingReadinessPanel({
  offeringId,
  providerName,
}: {
  offeringId: string;
  providerName: string;
}) {
  const [assessment, setAssessment] = useState<RailOnboardingReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAssessment(null);

    void fetch(
      `/api/business-passport/readiness?offeringId=${encodeURIComponent(offeringId)}`,
      { credentials: 'include', cache: 'no-store' }
    )
      .then(async (response) => {
        const payload = (await response.json()) as RailOnboardingReadiness & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.error ?? 'Unable to load onboarding readiness.');
          return;
        }
        setAssessment(payload);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load onboarding readiness.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [offeringId]);

  return (
    <div
      className="mt-3 space-y-3 rounded-xl border border-border bg-background p-3"
      data-testid="onboarding-readiness-panel"
    >
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Alternative route identified
        </div>
        <p className="mt-1 text-[13px] font-medium text-foreground">
          {assessment?.providerName ?? providerName}
        </p>
      </div>

      {loading ? (
        <p className="text-[12px] text-ink-soft">Checking information already available to Provvy…</p>
      ) : null}

      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}

      {assessment ? (
        <>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              Onboarding readiness
            </div>
            <p className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
              {assessment.percent}%
            </p>
            <p className="text-[12px] text-ink-soft">
              Provvy already has {assessment.presentCount} of {assessment.applicableCount}{' '}
              information requirements.
            </p>
          </div>

          {assessment.complete.length > 0 ? (
            <div>
              <div className="font-medium text-foreground">Complete</div>
              <ul className="mt-1 space-y-1 text-[12px] text-ink-soft">
                {assessment.complete.map((row) => (
                  <li key={row.requirementId}>
                    ✓ {row.label}
                    {row.status === 'stale' ? ' (needs refresh)' : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {assessment.stillRequired.length > 0 ? (
            <div>
              <div className="font-medium text-foreground">Still required</div>
              <ul className="mt-1 space-y-1 text-[12px] text-ink-soft">
                {assessment.stillRequired.map((row) => (
                  <li key={row.requirementId}>○ {row.label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {assessment.notAssessed.length > 0 ? (
            <div>
              <div className="font-medium text-foreground">Not assessed</div>
              <ul className="mt-1 space-y-1 text-[12px] text-ink-soft">
                {assessment.notAssessed.map((row) => (
                  <li key={row.requirementId}>○ {row.label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {assessment.notes.map((note) => (
            <p key={note} className="text-[11px] text-ink-soft">
              {note}
            </p>
          ))}

          <p className="text-[11px] text-ink-soft">{assessment.disclaimer}</p>
        </>
      ) : null}
    </div>
  );
}
