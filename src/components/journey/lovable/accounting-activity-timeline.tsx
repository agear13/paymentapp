'use client';

import {
  buildAccountingActivityTimeline,
  formatAccountingActivityDate,
  type XeroSyncForActivityTimeline,
} from '@/lib/accounting/accounting-activity-timeline';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';

type AccountingActivityTimelineProps = {
  syncs: XeroSyncForActivityTimeline[] | null | undefined;
};

const KIND_ICON: Record<string, string> = {
  exported: '✓',
  updated: '✓',
  voided: '✓',
  payment_synced: '✓',
  sync_failed: '!',
};

export function AccountingActivityTimeline({ syncs }: AccountingActivityTimelineProps) {
  const events = buildAccountingActivityTimeline(syncs);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h2 className="text-[13.5px] font-semibold">
        {ACCOUNTING_INTEGRATION_COPY.accountingActivityTitle}
      </h2>

      {events.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-soft">
          {ACCOUNTING_INTEGRATION_COPY.accountingActivityEmpty}
        </p>
      ) : (
        <ol className="mt-4 space-y-0">
          {events.map((event, index) => (
            <li key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    event.kind === 'sync_failed'
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-emerald-500/15 text-emerald-700'
                  }`}
                  aria-hidden
                >
                  {KIND_ICON[event.kind] ?? '✓'}
                </span>
                {index < events.length - 1 ? (
                  <span className="my-1 text-[11px] text-ink-soft" aria-hidden>
                    ↓
                  </span>
                ) : null}
              </div>
              <div className="pb-4">
                <div className="text-[13px] font-medium text-foreground">{event.label}</div>
                <div className="mt-0.5 text-[12px] text-ink-soft">
                  {formatAccountingActivityDate(event.occurredAt)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
