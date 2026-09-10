import { buildPayoutTimeline } from '@/lib/payouts/payout-status-presentation';
import { cn } from '@/lib/utils';

function formatDetail(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime()) && value.length >= 10) {
    return date.toLocaleString();
  }
  return value;
}

export function PayoutTimeline({
  status,
  railId,
  createdAt,
  paidAt,
  failedReason,
  className,
}: {
  status?: string | null;
  railId?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  failedReason?: string | null;
  className?: string;
}) {
  const steps = buildPayoutTimeline({ status, railId, createdAt, paidAt, failedReason });

  return (
    <ol className={cn('space-y-3', className)}>
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                'mt-0.5 h-2.5 w-2.5 rounded-full border',
                step.state === 'complete' && 'border-green-600 bg-green-600',
                step.state === 'current' && 'border-amber-500 bg-amber-500',
                step.state === 'upcoming' && 'border-border bg-background'
              )}
            />
            {index < steps.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="pb-3">
            <p
              className={cn(
                'text-sm font-medium',
                step.state === 'upcoming' && 'text-muted-foreground'
              )}
            >
              {step.label}
            </p>
            {step.detail ? (
              <p className="text-xs text-muted-foreground">{formatDetail(step.detail)}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
