'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { OnboardingReadinessPanel } from '@/components/business-passport/onboarding-readiness-panel';
import { selectPassportOffering } from '@/lib/business-passport/select-offering';
import type { PaymentAdvisorPaymentContextInput } from '@/lib/advisor/payment-advisor-context';
import type { PaymentAdvisorResponse } from '@/lib/advisor/payment-advisor-types';
import {
  collectComparedRoutes,
  shouldDisplayRouteWinner,
} from '@/lib/commercial-os/commitment-fulfillment-presentation';
import { formatCommitmentCorridorLabel } from '@/lib/commercial-os/commitment-route-context';

export function CommitmentFulfillmentCard({
  payment,
}: {
  payment: PaymentAdvisorPaymentContextInput;
}) {
  const [result, setResult] = useState<PaymentAdvisorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const origin = payment.origin;
  const destination = payment.destination;
  const amount = payment.amount;
  const sourceCurrency = payment.sourceCurrency;
  const destinationCurrency = payment.destinationCurrency;
  const priority = payment.priority;
  const transactionType = payment.transactionType;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);

    void fetch('/api/advisor/ask', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'airwallex_scenario_comparison',
        payment: {
          origin,
          destination,
          amount,
          sourceCurrency,
          destinationCurrency,
          priority,
          transactionType,
        },
      }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as PaymentAdvisorResponse & {
          ok?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok || payload.ok === false) {
          setError(payload.error ?? 'Unable to load payment route intelligence.');
          return;
        }
        setResult(payload);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load payment route intelligence.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    origin,
    destination,
    amount,
    sourceCurrency,
    destinationCurrency,
    priority,
    transactionType,
  ]);

  const routes = useMemo(() => (result ? collectComparedRoutes(result) : []), [result]);
  const claimWinner = shouldDisplayRouteWinner(result?.explanation);
  const passportOffering = result
    ? selectPassportOffering({
        scenarioOffering: result.scenarioComparison?.scenarioOffering
          ? {
              offeringId: result.scenarioComparison.scenarioOffering.offeringId,
              providerId: result.scenarioComparison.scenarioOffering.providerId,
              providerName: result.scenarioComparison.scenarioOffering.providerName,
            }
          : null,
        alternatives: result.alternatives ?? [],
      })
    : null;

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
      data-testid="commitment-fulfillment-card"
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
        Payment route intelligence
      </div>
      <p className="mt-2 text-[15px] font-semibold text-foreground">
        How could this commitment be fulfilled?
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        {formatCommitmentCorridorLabel(payment)}. The source agreement settles by bank transfer.
        These are existing Payment Intelligence alternatives — not a payment and not supplier
        acceptance.
      </p>

      {loading ? (
        <p className="mt-4 inline-flex items-center gap-2 text-[13px] text-ink-soft">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking payment intelligence…
        </p>
      ) : null}

      {error ? <p className="mt-4 text-[13px] text-destructive">{error}</p> : null}

      {result ? (
        <div className="mt-4 space-y-3">
          {claimWinner && result.recommendation ? (
            <p className="text-[13px] text-foreground">
              Displayed recommendation from current route evidence:{' '}
              {result.recommendation.providerName} · {result.recommendation.productName}
            </p>
          ) : (
            <p className="text-[13px] text-ink-soft">
              Provvy does not have enough evidence to rank one route as cheaper or better for this
              commitment. The routes below are alternatives.
            </p>
          )}

          {routes.length > 0 ? (
            <ul className="space-y-2 text-[13px]">
              {routes.map((route) => (
                <li
                  key={route.offeringId}
                  className="rounded-xl border border-border bg-background p-3"
                >
                  <p className="font-medium text-foreground">
                    {route.providerName} · {route.productName}
                  </p>
                  <p className="mt-1 text-ink-soft">
                    Indicative catalogue: {route.pricing.totalLabel} (
                    {route.pricing.kind.replace(/_/g, ' ')})
                  </p>
                  {route.whyShort ? (
                    <p className="mt-1 text-[12px] text-ink-soft">{route.whyShort}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-soft">
              No comparable routes are available for this corridor with current intelligence.
            </p>
          )}

          {result.unknowns.length > 0 ? (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                What is unknown
              </div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] text-ink-soft">
                {result.unknowns.map((item) => (
                  <li key={item.kind}>{item.text}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {passportOffering ? (
            <OnboardingReadinessPanel
              offeringId={passportOffering.offeringId}
              providerName={passportOffering.providerName}
            />
          ) : null}

          <p className="text-[11px] text-ink-soft">{result.dataFreshness.disclaimer}</p>
        </div>
      ) : null}
    </section>
  );
}
