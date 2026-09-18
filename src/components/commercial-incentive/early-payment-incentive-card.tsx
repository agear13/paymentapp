'use client';

import { useCallback, useEffect, useState } from 'react';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import type { EarlyPaymentIncentiveView } from '@/lib/commercial-incentive/types';

function moneyLabel(amount: number | null, currency: string | null): string | null {
  if (amount == null) return null;
  const code = currency?.trim() || 'AUD';
  return `${code === 'AUD' ? 'A$' : `${code} `}${amount.toLocaleString('en-AU', {
    maximumFractionDigits: 2,
  })}`;
}

export function EarlyPaymentIncentiveCard({
  workflowId,
  agreementId,
}: {
  workflowId?: string | null;
  agreementId?: string | null;
}) {
  const [view, setView] = useState<EarlyPaymentIncentiveView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (workflowId) params.set('workflowId', workflowId);
    if (agreementId) params.set('agreementId', agreementId);
    const query = params.toString();
    try {
      const response = await fetch(
        `/api/commercial-incentive/recommendation${query ? `?${query}` : ''}`,
        { credentials: 'include', cache: 'no-store' }
      );
      const payload = (await response.json()) as EarlyPaymentIncentiveView & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Unable to load commercial incentive recommendation.');
        setView(null);
        return;
      }
      setView(payload);
    } catch {
      setError('Unable to load commercial incentive recommendation.');
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [agreementId, workflowId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(action: 'approve' | 'dismiss') {
    if (!view?.recommendation || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await csrfAwareFetch('/api/commercial-incentive/recommendation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          workflowId: view.workflowId ?? workflowId ?? undefined,
          agreementId: view.agreementId ?? agreementId ?? undefined,
        }),
      });
      const payload = (await response.json()) as EarlyPaymentIncentiveView & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Unable to save that decision.');
        return;
      }
      setView(payload);
    } catch {
      setError('Unable to save that decision.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;
  if (!view) {
    return error ? <p className="text-[12px] text-destructive">{error}</p> : null;
  }

  const recommendation = view.recommendation;
  const decision = view.decision;
  if (!recommendation && !decision) return null;
  if (decision?.status === 'dismissed') return null;

  const economics = decision?.economics ?? recommendation?.economics;
  const standardLabel =
    decision?.sourceDueLabel ||
    recommendation?.sourceDueLabel ||
    view.originalDueLabels[0] ||
    'Net 30';
  const additionLabel = `Pay within ${
    decision?.acceleratedDays ?? recommendation?.acceleratedDays
  } days → ${decision?.incentivePercent ?? recommendation?.incentivePercent}% discount`;
  const milestoneMoney = moneyLabel(economics?.milestoneAmount ?? null, economics?.currency ?? null);
  const discountMoney = moneyLabel(
    economics?.milestoneDiscountAmount ?? null,
    economics?.currency ?? null
  );
  const earlyMoney = moneyLabel(economics?.earlyPaymentAmount ?? null, economics?.currency ?? null);
  const totalMoney = moneyLabel(
    economics?.totalIllustrativeDiscount ?? null,
    economics?.currency ?? null
  );
  const approved = decision?.status === 'approved';

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
      data-testid="early-payment-incentive-card"
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
        {approved ? 'Provvy-approved incentive' : 'Commercial opportunity identified'}
      </div>
      <p className="mt-2 text-[15px] font-semibold text-foreground">
        {approved
          ? `${decision?.incentivePercent ?? recommendation?.incentivePercent}% discount if paid within ${
              decision?.acceleratedDays ?? recommendation?.acceleratedDays
            } days`
          : "Here's your agreement. I found an opportunity."}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        {approved
          ? "You approved Provvy's proposed early-payment incentive. This is not a term extracted from the agreement, and it is not supplier acceptance."
          : `Your supplier is currently on ${standardLabel} payment terms. If you want to accelerate supplier payment, you could offer an early-payment incentive. This is a Provvy recommendation, not a term extracted from the agreement.`}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-secondary/10 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
            Source agreement
          </div>
          <p className="mt-1 text-[14px] font-medium text-foreground">{standardLabel}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-accent p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
            {approved ? 'Provvy-approved incentive' : 'Provvy recommendation'}
          </div>
          <p className="mt-1 text-[14px] font-medium text-foreground">{additionLabel}</p>
        </div>
      </div>

      <p className="mt-4 text-[13px]" data-testid="incentive-supplier-status">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
          Status
        </span>
        <span className="mt-1 block font-medium text-foreground">
          {approved ? 'Awaiting supplier acceptance' : 'Recommendation — awaiting your approval'}
        </span>
      </p>

      {economics?.amountsReliable && milestoneMoney && discountMoney && earlyMoney ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-3 text-[13px]">
          <p className="font-medium text-foreground">For a {milestoneMoney} milestone</p>
          <ul className="mt-2 space-y-1 text-ink-soft">
            <li>Standard payment: {milestoneMoney}</li>
            <li>Early payment: {earlyMoney}</li>
            <li>Potential saving: {discountMoney}</li>
            <li>Supplier paid {economics.daysEarlier} days earlier.</li>
          </ul>
          {economics.milestoneCount > 1 && totalMoney ? (
            <p className="mt-3 text-[12px] text-ink-soft">
              If the same option is accepted on each of {economics.milestoneCount} milestones, the
              illustrative total discount is {totalMoney}. It is not automatically active and is not
              a payment.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-ink-soft">
          Milestone amounts were not reliable in the extracted terms, so Provvy has not invented
          savings figures. The example is pay within{' '}
          {decision?.acceleratedDays ?? recommendation?.acceleratedDays} days for a{' '}
          {decision?.incentivePercent ?? recommendation?.incentivePercent}% discount.
        </p>
      )}

      {!approved ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void decide('approve')}
            className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground disabled:opacity-60"
            data-testid="add-incentive"
          >
            Add incentive
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void decide('dismiss')}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-[13px] font-medium text-foreground disabled:opacity-60"
            data-testid="not-now-incentive"
          >
            Not now
          </button>
        </div>
      ) : null}

      {!approved ? (
        <p className="mt-3 text-[12px] text-ink-soft">
          You decide whether to apply this. Provvy won&apos;t change the agreement without your
          approval.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-[12px] text-destructive">{error}</p> : null}
      <p className="mt-3 text-[11px] text-ink-soft">{view.disclaimer}</p>
    </section>
  );
}
