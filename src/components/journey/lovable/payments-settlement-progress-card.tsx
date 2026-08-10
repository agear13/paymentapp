'use client';

import Link from 'next/link';
import { Clock, CreditCard } from 'lucide-react';
import { usePaymentsSettlementReadiness } from '@/hooks/use-payments-settlement-readiness';
import { PaymentsCheckPill } from '@/components/journey/lovable/payments-settlement-ui';
import type { PaymentsSetupChecklistItem } from '@/lib/commercial-os/payments-settlement-readiness';

export function PaymentsSettlementProgressCard() {
  const { loading, readiness } = usePaymentsSettlementReadiness();

  if (loading) {
    return (
      <section className="animate-pulse rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="h-24 rounded-lg bg-secondary" />
          <div className="h-24 rounded-lg bg-secondary" />
          <div className="h-24 rounded-lg bg-secondary" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Current status
          </div>
          <div className="mt-2 flex items-center gap-2 text-[14px] font-medium">
            <span
              className={`h-2 w-2 rounded-full ${
                readiness.customerPaymentsEnabled ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {readiness.customerPaymentsEnabled
              ? 'Customer payments are enabled'
              : 'Customer payments are not yet enabled'}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            {readiness.doneCount} of {readiness.checklist.length} setup steps complete.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-purple transition-all duration-500"
              style={{ width: `${(readiness.doneCount / readiness.checklist.length) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Remaining work
          </div>
          <ul className="mt-2 space-y-2">
            {readiness.checklist
              .filter((item) => !item.done)
              .slice(0, 4)
              .map((item) => (
                <PaymentsCheckPill key={item.id} done={false}>
                  {item.label}
                </PaymentsCheckPill>
              ))}
            {readiness.requiredDone ? (
              <PaymentsCheckPill done>
                Nothing outstanding — you&apos;re ready to collect
              </PaymentsCheckPill>
            ) : null}
          </ul>
        </div>

        <div className="md:justify-self-end">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Estimated setup time
          </div>
          <div className="mt-2 flex items-center gap-2 text-[22px] font-semibold tracking-[-0.02em]">
            <Clock className="h-4 w-4 text-ink-soft" />
            {readiness.estimatedMinutes} minutes
          </div>
          <p className="mt-1 text-[12.5px] text-ink-soft">Guided, one section at a time.</p>
        </div>
      </div>
    </section>
  );
}

export function PaymentsSettlementCommercialReadiness({
  checklist,
  doneCount,
  requiredDone,
  returnHref,
}: {
  checklist: PaymentsSetupChecklistItem[];
  doneCount: number;
  requiredDone: boolean;
  returnHref?: string;
}) {
  return (
    <section
      className={`rounded-2xl border p-6 shadow-card sm:p-7 ${
        requiredDone ? 'border-primary/25 bg-accent/30' : 'border-border bg-card'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-background/50 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-primary">
            <CreditCard className="size-3" />
            Commercial Readiness
          </div>
          <h2 className="mt-3 text-[16px] font-semibold tracking-[-0.01em]">
            {requiredDone
              ? 'Commercial Operations Ready'
              : 'A few steps from collecting payments'}
          </h2>
          <p className="mt-1 max-w-lg text-[13px] text-ink-soft">
            {requiredDone
              ? 'Provvy can now collect, settle and reconcile customer payments end to end.'
              : 'Complete the required steps below and Provvy will switch on customer payments for you.'}
          </p>
          <ul className="mt-4 space-y-2">
            {checklist.map((item) => (
              <PaymentsCheckPill key={item.id} done={item.done}>
                {item.label}
              </PaymentsCheckPill>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Progress
          </div>
          <div className="text-4xl font-semibold tracking-[-0.03em]">
            {doneCount}
            <span className="text-xl text-ink-soft">/{checklist.length}</span>
          </div>
          {returnHref ? (
            <Link
              href={returnHref}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12.5px] font-medium shadow-soft transition-colors hover:bg-secondary"
            >
              Back to invoice
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
