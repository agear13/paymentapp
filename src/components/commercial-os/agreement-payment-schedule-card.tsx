'use client';

import {
  formatScheduleMoney,
  type AgreementPaymentScheduleView,
} from '@/lib/commercial-os/payment-schedule-presentation';

export function AgreementPaymentScheduleCard({
  schedule,
}: {
  schedule: AgreementPaymentScheduleView;
}) {
  const currency = schedule.currency;
  const unit = formatScheduleMoney(schedule.equalMilestoneAmount, currency);
  const total = formatScheduleMoney(schedule.totalAmount, currency);
  const nextAmount = formatScheduleMoney(schedule.next?.amount ?? null, currency);
  const remaining = formatScheduleMoney(schedule.remainingAmount, currency);

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
      data-testid="agreement-payment-schedule"
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
        Payment schedule
      </div>
      <p className="mt-2 text-[15px] font-semibold text-foreground">
        {schedule.equalMilestoneAmount != null && unit
          ? `${schedule.milestoneCount} milestones × ${unit}`
          : `${schedule.milestoneCount} milestone${schedule.milestoneCount === 1 ? '' : 's'}`}
      </p>
      {total ? (
        <p className="mt-1 text-[13px] text-ink-soft">Total commitment: {total}</p>
      ) : (
        <p className="mt-1 text-[13px] text-ink-soft">
          Total commitment is taken from extracted payment terms. Missing amounts are not invented.
        </p>
      )}

      {schedule.next ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 text-[13px]">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">Next obligation</div>
            <p className="mt-1 font-medium">Milestone {schedule.next.index}</p>
            <p className="mt-1 text-foreground">{schedule.next.label}</p>
            {nextAmount ? <p className="mt-1 font-semibold">{nextAmount}</p> : null}
            {schedule.next.dueLabel ? (
              <p className="mt-1 text-ink-soft">{schedule.next.dueLabel}</p>
            ) : null}
          </div>
          {schedule.remainingCount > 0 ? (
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-[11px] uppercase tracking-wide text-ink-soft">Remaining</div>
              <p className="mt-1 font-medium">
                {schedule.remainingCount} milestone{schedule.remainingCount === 1 ? '' : 's'}
              </p>
              {remaining ? <p className="mt-1 font-semibold">{remaining}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-4 space-y-2 text-[13px]">
        {schedule.items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <span className="font-medium">
              Milestone {index + 1}: {item.label}
            </span>
            {item.amount != null ? (
              <span className="ml-2 font-semibold">
                {formatScheduleMoney(item.amount, currency)}
              </span>
            ) : null}
            {item.dueLabel ? (
              <p className="text-[12px] text-ink-soft">{item.dueLabel}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
